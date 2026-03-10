"""
URL configuration for appointment_scheduling project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

from backend_api.views.telegram_views import (
    telegram_webhook,
    generate_link_token,
    check_telegram_status,
    unlink_telegram,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include("backend_api.urls")),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("user/", include("django.contrib.auth.urls")),

    # Telegram bot webhook and account linking API
    path('api/telegram/webhook/', telegram_webhook, name='telegram-webhook'),
    path('api/telegram/generate-link/', generate_link_token, name='telegram-generate-link'),
    path('api/telegram/status/', check_telegram_status, name='telegram-status'),
    path('api/telegram/unlink/', unlink_telegram, name='telegram-unlink'),
]
