import logging
import os

import requests
from dotenv import load_dotenv, find_dotenv

logger = logging.getLogger(__name__)


def update_api_key():
    env = find_dotenv()
    load_dotenv(env)

    url = "https://www.onemap.gov.sg/api/auth/post/getToken"

    payload = {
        "email": os.getenv("ONEMAP_API_EMAIL"),
        "password": os.getenv("ONEMAP_API_PASSWORD"),
    }

    response = requests.request("POST", url, json=payload, timeout=10)
    if response.status_code != 200:
        logger.error("Error: %s", response.json())
        return

    # update the token in .env file
    with open(env, "r+") as file:
        data = file.readlines()
        key_found = False
        for i, line in enumerate(data):
            if line.startswith("ONEMAP_API_KEY"):
                data[i] = "ONEMAP_API_KEY=" + response.json()["access_token"] + "\n"
                key_found = True
                break

        if not key_found:
            data.append("\nONEMAP_API_KEY=" + response.json()["access_token"] + "\n")

        # Move the pointer to the beginning of the file to overwrite
        file.seek(0)
        file.writelines(data)
        # Truncate the file to the current position to remove any old content beyond this point
        file.truncate()

    logger.info("Token updated successfully!")
    return response.json()["access_token"]


if __name__ == "__main__":
    update_api_key()
