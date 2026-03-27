import logging
import os

import requests
from dotenv import load_dotenv, find_dotenv
from requests.exceptions import RequestException

logger = logging.getLogger(__name__)

load_dotenv(find_dotenv())
ONEMAP_API_KEY = os.getenv("ONEMAP_API_KEY", "")


def update_api_key():
    global ONEMAP_API_KEY

    load_dotenv(find_dotenv())

    url = "https://www.onemap.gov.sg/api/auth/post/getToken"

    payload = {
        "email": os.getenv("ONEMAP_EMAIL"),
        "password": os.getenv("ONEMAP_PASSWORD"),
    }

    if not payload["email"] or not payload["password"]:
        raise ValueError("ONEMAP_EMAIL and ONEMAP_PASSWORD must be set")

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
    except RequestException as exc:
        logger.error("Failed to refresh OneMap token: %s", exc)
        raise RuntimeError("Failed to refresh OneMap token") from exc

    try:
        access_token = response.json()["access_token"]
    except (KeyError, TypeError, ValueError) as exc:
        logger.error("Invalid OneMap token response: %s", response.text)
        raise RuntimeError("Invalid response while refreshing OneMap token") from exc

    ONEMAP_API_KEY = access_token
    logger.info("Token refreshed successfully")
    return access_token


if __name__ == "__main__":
    update_api_key()
