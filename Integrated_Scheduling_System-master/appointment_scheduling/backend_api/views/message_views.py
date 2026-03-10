import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Messages, Coordinators, Appointments
from ..serializers import MessageSerializer
from ..utils.notifications import send_new_message_telegram

logger = logging.getLogger(__name__)


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Messages.objects.all()
    serializer_class = MessageSerializer

    def list(self, request, *args, **kwargs):
        """
        Get messages for a specific user (filtered by recipient or sender)
        Query params: recipientId, recipientType, senderId, senderType
        """
        query_params = request.query_params

        # Filter by recipient
        if "recipientId" in query_params and "recipientType" in query_params:
            messages = Messages.objects.filter(
                recipientId=query_params["recipientId"],
                recipientType=query_params["recipientType"],
            )
        # Filter by sender
        elif "senderId" in query_params and "senderType" in query_params:
            messages = Messages.objects.filter(
                senderId=query_params["senderId"], senderType=query_params["senderType"]
            )
        # Get both sent and received messages for a user
        elif "userId" in query_params and "userType" in query_params:
            user_id = query_params["userId"]
            user_type = query_params["userType"]
            messages = Messages.objects.filter(
                models.Q(recipientId=user_id, recipientType=user_type)
                | models.Q(senderId=user_id, senderType=user_type)
            )
        # Filter by unread messages
        elif "unread" in query_params:
            recipient_id = query_params.get("recipientId")
            recipient_type = query_params.get("recipientType")
            if recipient_id and recipient_type:
                messages = Messages.objects.filter(
                    recipientId=recipient_id, recipientType=recipient_type, isRead=False
                )
            else:
                return Response(
                    {
                        "error": "recipientId and recipientType required for unread messages"
                    },
                    status=400,
                )
        else:
            messages = Messages.objects.all()

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=200)

    def create(self, request, *args, **kwargs):
        """
        Create a new message.
        Special handling for customer messages: they are sent to both coordinator AND technician
        """
        data = request.data
        sender_type = data.get("senderType")

        # Special handling for customer messages
        if sender_type == "customer":
            sender_id = data.get("senderId")
            sender_name = data.get("senderName")
            subject = data.get("subject")
            body = data.get("body")

            # Detailed validation
            missing_fields = []
            if not sender_id:
                missing_fields.append("senderId")
            if not sender_name:
                missing_fields.append("senderName")
            if not subject:
                missing_fields.append("subject")
            if not body:
                missing_fields.append("body")

            if missing_fields:
                return Response(
                    {"error": f"Missing required fields: {', '.join(missing_fields)}"},
                    status=400,
                )

            messages_created = []

            # Find the first coordinator (you might want to implement better logic here)
            try:
                coordinator = Coordinators.objects.first()
                if coordinator:
                    # Create message to coordinator
                    coordinator_message = Messages.objects.create(
                        senderId=sender_id,
                        senderType="customer",
                        senderName=sender_name,
                        recipientId=coordinator.id,
                        recipientType="coordinator",
                        recipientName=coordinator.coordinatorName,
                        subject=subject,
                        body=body,
                    )
                    messages_created.append(coordinator_message)
                    # Coordinators don't have Telegram (no telegramChatId field),
                    # but the function handles this gracefully.
            except Exception as e:
                logger.exception("Failed to create coordinator message: %s", e)

            # Find technician from customer's appointments
            try:
                # Get the most recent appointment for this customer
                appointment = (
                    Appointments.objects.filter(customerId=sender_id)
                    .order_by("-appointmentStartTime")
                    .first()
                )

                if appointment and appointment.technicianId:
                    # Create message to technician
                    technician_message = Messages.objects.create(
                        senderId=sender_id,
                        senderType="customer",
                        senderName=sender_name,
                        recipientId=appointment.technicianId.id,
                        recipientType="technician",
                        recipientName=appointment.technicianId.technicianName,
                        subject=subject,
                        body=body,
                        relatedAppointment=appointment,
                    )
                    messages_created.append(technician_message)

                    # Notify technician via Telegram
                    send_new_message_telegram(
                        "technician",
                        appointment.technicianId.id,
                        sender_name,
                        subject,
                    )
            except Exception as e:
                logger.exception("Failed to create technician message: %s", e)

            if messages_created:
                serializer = MessageSerializer(messages_created, many=True)
                return Response(
                    {
                        "success": True,
                        "messages": serializer.data,
                        "count": len(messages_created),
                    },
                    status=201,
                )
            else:
                return Response({"error": "Failed to create any messages"}, status=400)

        # For non-customer messages, use standard creation
        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():
            message = serializer.save()

            # Notify recipient via Telegram
            send_new_message_telegram(
                message.recipientType,
                message.recipientId,
                message.senderName,
                message.subject,
            )

            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=["patch"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        """
        Mark a message as read
        """
        message = get_object_or_404(Messages, pk=pk)
        message.isRead = True
        message.readAt = timezone.now()
        message.save()

        serializer = MessageSerializer(message)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["get"], url_path="inbox")
    def inbox(self, request):
        """
        Get inbox (received messages) for a user
        """
        recipient_id = request.query_params.get("recipientId")
        recipient_type = request.query_params.get("recipientType")

        if not recipient_id or not recipient_type:
            return Response(
                {"error": "recipientId and recipientType are required"}, status=400
            )

        messages = Messages.objects.filter(
            recipientId=recipient_id, recipientType=recipient_type
        ).order_by("-created_at")

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["get"], url_path="sent")
    def sent(self, request):
        """
        Get sent messages for a user
        """
        sender_id = request.query_params.get("senderId")
        sender_type = request.query_params.get("senderType")

        if not sender_id or not sender_type:
            return Response(
                {"error": "senderId and senderType are required"}, status=400
            )

        messages = Messages.objects.filter(
            senderId=sender_id, senderType=sender_type
        ).order_by("-created_at")

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """
        Get count of unread messages for a user
        """
        recipient_id = request.query_params.get("recipientId")
        recipient_type = request.query_params.get("recipientType")

        if not recipient_id or not recipient_type:
            return Response(
                {"error": "recipientId and recipientType are required"}, status=400
            )

        count = Messages.objects.filter(
            recipientId=recipient_id, recipientType=recipient_type, isRead=False
        ).count()

        return Response({"unreadCount": count}, status=200)
