import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Messages, Coordinators, Appointments, Customers, Technicians
from ..serializers import MessageSerializer
from ..utils.notifications import send_new_message_telegram

logger = logging.getLogger(__name__)


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Messages.objects.all()
    serializer_class = MessageSerializer

    def _role(self, request):
        role = (
            getattr(request.auth, "payload", {}).get("role") if request.auth else None
        )
        return role or getattr(request.user, "role", None)

    def _require_role(self, request, allowed_roles):
        return self._role(request) in allowed_roles

    def _get_user_id(self, request):
        user_id = (
            getattr(request.auth, "payload", {}).get("user_id")
            if request.auth
            else None
        )
        if user_id is None:
            user_id = getattr(request.user, "id", None) or getattr(
                request.user, "pk", None
            )
        return str(user_id) if user_id is not None else None

    def _get_user_name(self, role, user_id):
        if role == "customer":
            return (
                Customers.objects.filter(pk=user_id)
                .values_list("customerName", flat=True)
                .first()
            )
        if role == "technician":
            return (
                Technicians.objects.filter(pk=user_id)
                .values_list("technicianName", flat=True)
                .first()
            )
        if role == "coordinator":
            return (
                Coordinators.objects.filter(pk=user_id)
                .values_list("coordinatorName", flat=True)
                .first()
            )
        return None

    def get_queryset(self):
        qs = Messages.objects.select_related("relatedAppointment")
        request = getattr(self, "request", None)
        if request is None:
            return qs

        role = self._role(request)
        user_id = self._get_user_id(request)

        if role == "coordinator":
            return qs
        if role in ("customer", "technician") and user_id:
            return qs.filter(
                models.Q(recipientId=user_id, recipientType=role)
                | models.Q(senderId=user_id, senderType=role)
            )
        return qs.none()

    def _get_message_participant_filters(self, request):
        role = self._role(request)
        user_id = self._get_user_id(request)

        if role == "coordinator":
            target_id = request.query_params.get("userId")
            target_type = request.query_params.get("userType")
            if target_id and target_type:
                return target_id, target_type

            recipient_id = request.query_params.get("recipientId")
            recipient_type = request.query_params.get("recipientType")
            if recipient_id and recipient_type:
                return recipient_id, recipient_type

            sender_id = request.query_params.get("senderId")
            sender_type = request.query_params.get("senderType")
            if sender_id and sender_type:
                return sender_id, sender_type

        return user_id, role

    def list(self, request, *args, **kwargs):
        """
        Get messages for a specific user (filtered by recipient or sender)
        Query params: recipientId, recipientType, senderId, senderType
        """
        query_params = request.query_params
        role = self._role(request)
        user_id = self._get_user_id(request)
        messages = self.get_queryset()

        if role not in ("customer", "technician", "coordinator") or not user_id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        if role == "coordinator":
            if "recipientId" in query_params and "recipientType" in query_params:
                messages = messages.filter(
                    recipientId=query_params["recipientId"],
                    recipientType=query_params["recipientType"],
                )
            elif "senderId" in query_params and "senderType" in query_params:
                messages = messages.filter(
                    senderId=query_params["senderId"],
                    senderType=query_params["senderType"],
                )
            elif "userId" in query_params and "userType" in query_params:
                messages = messages.filter(
                    models.Q(
                        recipientId=query_params["userId"],
                        recipientType=query_params["userType"],
                    )
                    | models.Q(
                        senderId=query_params["userId"],
                        senderType=query_params["userType"],
                    )
                )
            elif "unread" in query_params:
                target_id, target_type = self._get_message_participant_filters(request)
                messages = messages.filter(
                    recipientId=target_id,
                    recipientType=target_type,
                    isRead=False,
                )
        elif "unread" in query_params:
            messages = messages.filter(
                recipientId=user_id,
                recipientType=role,
                isRead=False,
            )
        elif "recipientId" in query_params or "recipientType" in query_params:
            messages = messages.filter(
                recipientId=user_id,
                recipientType=role,
            )
        elif "senderId" in query_params or "senderType" in query_params:
            messages = messages.filter(
                senderId=user_id,
                senderType=role,
            )
        else:
            messages = messages.order_by("-created_at")

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=200)

    def create(self, request, *args, **kwargs):
        """
        Create a new message.
        Special handling for customer messages: they are sent to both coordinator AND technician
        """
        data = request.data.copy()
        sender_id = self._get_user_id(request)
        sender_type = self._role(request)
        sender_name = self._get_user_name(sender_type, sender_id)

        if (
            sender_type not in ("customer", "technician", "coordinator")
            or not sender_id
        ):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )
        if not sender_name:
            return Response(
                {"error": "Sender not found"}, status=status.HTTP_403_FORBIDDEN
            )

        data["senderId"] = sender_id
        data["senderType"] = sender_type
        data["senderName"] = sender_name

        # Special handling for customer messages
        if sender_type == "customer":
            subject = data.get("subject")
            body = data.get("body")

            # Detailed validation
            missing_fields = []
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
        serializer = MessageSerializer(data=data)
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
        user_id = self._get_user_id(request)
        role = self._role(request)

        if role not in ("customer", "technician", "coordinator") or not user_id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        message = get_object_or_404(
            Messages.objects.filter(recipientId=user_id, recipientType=role),
            pk=pk,
        )
        message.isRead = True
        message.readAt = timezone.now()
        message.save()

        serializer = MessageSerializer(message)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["patch"], url_path="mark-all-read")
    def mark_all_read(self, request):
        """
        Mark all inbox messages for the authenticated user as read
        """
        user_id = self._get_user_id(request)
        role = self._role(request)

        if role not in ("customer", "technician", "coordinator") or not user_id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        updated = Messages.objects.filter(
            recipientId=user_id,
            recipientType=role,
            isRead=False,
        ).update(isRead=True, readAt=timezone.now())

        return Response({"updated": updated}, status=200)

    @action(detail=False, methods=["get"], url_path="inbox")
    def inbox(self, request):
        """
        Get inbox (received messages) for a user
        """
        role = self._role(request)
        user_id = self._get_user_id(request)

        if role not in ("customer", "technician", "coordinator") or not user_id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        if role == "coordinator":
            recipient_id = request.query_params.get("recipientId") or user_id
            recipient_type = request.query_params.get("recipientType") or role
        else:
            recipient_id = user_id
            recipient_type = role

        messages = (
            self.get_queryset()
            .filter(recipientId=recipient_id, recipientType=recipient_type)
            .order_by("-created_at")
        )

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["get"], url_path="sent")
    def sent(self, request):
        """
        Get sent messages for a user
        """
        role = self._role(request)
        user_id = self._get_user_id(request)

        if role not in ("customer", "technician", "coordinator") or not user_id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        if role == "coordinator":
            sender_id = request.query_params.get("senderId") or user_id
            sender_type = request.query_params.get("senderType") or role
        else:
            sender_id = user_id
            sender_type = role

        messages = (
            self.get_queryset()
            .filter(senderId=sender_id, senderType=sender_type)
            .order_by("-created_at")
        )

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """
        Get count of unread messages for a user
        """
        user_id = self._get_user_id(request)
        role = self._role(request)

        if role not in ("customer", "technician", "coordinator") or not user_id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        count = Messages.objects.filter(
            recipientId=user_id, recipientType=role, isRead=False
        ).count()

        return Response({"unreadCount": count}, status=200)
