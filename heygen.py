"""
HeyGen Avatar Video Generation Module

Generates vertical (9:16) avatar videos with lip sync support.
Mirrors the translate.py pattern for consistency.
"""

import time
import httpx
from typing import Optional

HEYGEN_API_BASE = "https://api.heygen.com"
HEYGEN_UPLOAD_BASE = "https://upload.heygen.com"
POLL_INTERVAL = 5
DEFAULT_TIMEOUT = 300  # 5 minutes


def list_avatars(api_key: str) -> dict:
    """
    List all available avatars and talking photos.

    Returns:
        dict with 'avatars' and 'talking_photos' arrays
    """
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{HEYGEN_API_BASE}/v2/avatars",
            headers={"x-api-key": api_key},
        )

    if response.status_code != 200:
        raise Exception(f"HeyGen API error listing avatars: {response.text}")

    data = response.json().get("data", {})
    return {
        "avatars": data.get("avatars", []),
        "talking_photos": data.get("talking_photos", []),
    }


def list_voices(api_key: str) -> list:
    """
    List all available voices.

    Returns:
        list of voice dicts with voice_id, name, language, gender, preview_audio
    """
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{HEYGEN_API_BASE}/v2/voices",
            headers={"x-api-key": api_key},
        )

    if response.status_code != 200:
        raise Exception(f"HeyGen API error listing voices: {response.text}")

    return response.json().get("data", {}).get("voices", [])


def upload_asset(file_bytes: bytes, content_type: str, api_key: str) -> str:
    """
    Upload a raw asset (image or audio) to HeyGen CDN.

    Args:
        file_bytes: Raw file content
        content_type: MIME type (e.g. 'image/jpeg', 'audio/mpeg')
        api_key: HeyGen API key

    Returns:
        asset_id string for use in video generation
    """
    print(f"[HeyGen] Uploading asset ({content_type}, {len(file_bytes)} bytes)...")

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{HEYGEN_UPLOAD_BASE}/v1/asset",
            headers={"X-API-KEY": api_key, "Content-Type": content_type},
            content=file_bytes,
        )

    if response.status_code != 200:
        raise Exception(f"HeyGen upload error: {response.text}")

    asset_id = response.json().get("data", {}).get("id")
    if not asset_id:
        raise Exception("HeyGen upload returned no asset_id")

    print(f"[HeyGen] Asset uploaded: {asset_id}")
    return asset_id


def generate_video(
    api_key: str,
    script_text: Optional[str] = None,
    voice_id: Optional[str] = None,
    avatar_id: Optional[str] = None,
    talking_photo_id: Optional[str] = None,
    audio_asset_id: Optional[str] = None,
    background_color: str = "#000000",
) -> str:
    """
    Submit a video generation request to HeyGen.

    Modes:
    - Script + Avatar/TalkingPhoto + Voice: text-to-speech avatar video
    - Lip Sync: avatar animated to an existing audio asset

    Returns:
        video_id for polling
    """
    # Build character block
    if talking_photo_id:
        character = {"type": "talking_photo", "talking_photo_id": talking_photo_id}
    elif avatar_id:
        character = {"type": "avatar", "avatar_id": avatar_id, "scale": 1.0, "avatar_style": "normal"}
    else:
        raise ValueError("Either avatar_id or talking_photo_id is required")

    # Build voice block
    if audio_asset_id:
        voice = {"type": "audio", "audio_asset_id": audio_asset_id}
    elif script_text and voice_id:
        voice = {"type": "text", "voice_id": voice_id, "input_text": script_text, "speed": 1.0}
    else:
        raise ValueError("Either (script_text + voice_id) or audio_asset_id is required")

    payload = {
        "video_inputs": [
            {
                "character": character,
                "voice": voice,
                "background": {"type": "color", "value": background_color},
            }
        ],
        "dimension": {"width": 1080, "height": 1920},
        "caption": False,
    }

    print("[HeyGen] Submitting video generation request...")
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{HEYGEN_API_BASE}/v2/video/generate",
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
        )

    if response.status_code != 200:
        error = response.json().get("error", {})
        raise Exception(f"HeyGen generation error: {error.get('message', response.text)}")

    video_id = response.json().get("data", {}).get("video_id")
    if not video_id:
        raise Exception("HeyGen returned no video_id")

    print(f"[HeyGen] Video submitted: {video_id}")
    return video_id


def get_video_status(video_id: str, api_key: str) -> dict:
    """
    Poll the status of a video generation job.

    Returns:
        dict with status, video_url, thumbnail_url, duration, error
    """
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{HEYGEN_API_BASE}/v1/video_status.get",
            params={"video_id": video_id},
            headers={"x-api-key": api_key},
        )

    if response.status_code != 200:
        raise Exception(f"HeyGen status error: {response.text}")

    data = response.json().get("data", {})
    return {
        "status": data.get("status"),
        "video_url": data.get("video_url"),
        "thumbnail_url": data.get("thumbnail_url"),
        "duration": data.get("duration"),
        "error": data.get("error"),
    }


def generate_video_sync(
    api_key: str,
    script_text: Optional[str] = None,
    voice_id: Optional[str] = None,
    avatar_id: Optional[str] = None,
    talking_photo_id: Optional[str] = None,
    audio_asset_id: Optional[str] = None,
    background_color: str = "#000000",
    max_wait_seconds: int = DEFAULT_TIMEOUT,
) -> dict:
    """
    Blocking wrapper: submit, poll, and return the completed video result.

    Returns:
        dict with video_url, thumbnail_url, duration
    """
    video_id = generate_video(
        api_key=api_key,
        script_text=script_text,
        voice_id=voice_id,
        avatar_id=avatar_id,
        talking_photo_id=talking_photo_id,
        audio_asset_id=audio_asset_id,
        background_color=background_color,
    )

    start = time.time()
    while True:
        elapsed = time.time() - start
        if elapsed > max_wait_seconds:
            raise Exception(f"[HeyGen] Timed out after {max_wait_seconds}s")

        result = get_video_status(video_id, api_key)
        status = result["status"]
        print(f"[HeyGen] Status: {status} (elapsed: {int(elapsed)}s)")

        if status == "completed":
            return result

        if status == "failed":
            raise Exception(f"[HeyGen] Video generation failed: {result.get('error', 'unknown error')}")

        time.sleep(POLL_INTERVAL)
