"""
Client tools for Lincohl voice agent.

These run locally on the Raspberry Pi when the ElevenLabs LLM invokes them.
Each handler accepts a dict of parameters and returns a string result.
"""

import os
import logging

import requests as http_requests

log = logging.getLogger("lincohl.tools")

# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


def get_weather(parameters: dict) -> str:
    """Fetch current weather for a location via wttr.in."""
    location = parameters.get("location", "").strip()
    if not location:
        return "No location provided. Please specify a city or place."

    log.info("get_weather: fetching weather for '%s'", location)
    try:
        resp = http_requests.get(
            f"https://wttr.in/{location}?format=j1",
            timeout=10,
            headers={"User-Agent": "lincohl-pi/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()

        current = data.get("current_condition", [{}])[0]
        temp_c = current.get("temp_C", "?")
        temp_f = current.get("temp_F", "?")
        desc = current.get("weatherDesc", [{}])[0].get("value", "unknown")
        humidity = current.get("humidity", "?")
        wind_kmph = current.get("windspeedKmph", "?")
        feels_like = current.get("FeelsLikeC", "?")

        area = data.get("nearest_area", [{}])[0]
        area_name = area.get("areaName", [{}])[0].get("value", location)
        country = area.get("country", [{}])[0].get("value", "")

        result = (
            f"Weather in {area_name}, {country}: {desc}. "
            f"Temperature: {temp_c}C ({temp_f}F), feels like {feels_like}C. "
            f"Humidity: {humidity}%. Wind: {wind_kmph} km/h."
        )
        log.info("get_weather: %s", result)
        return result

    except http_requests.exceptions.HTTPError as e:
        log.error("get_weather HTTP error: %s", e)
        return f"Could not fetch weather for '{location}'. The location may not be recognized."
    except Exception as e:
        log.error("get_weather error: %s", e)
        return f"Weather lookup failed: {e}"


def get_time(parameters: dict) -> str:
    """Get current time for a timezone using Python's zoneinfo (no network needed)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo, available_timezones

    timezone = parameters.get("timezone", "").strip()
    if not timezone:
        return "No timezone provided. Please specify a timezone like 'America/New_York' or 'Europe/London'."

    log.info("get_time: computing time for '%s'", timezone)
    try:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        utc_offset = now.strftime("%z")
        utc_offset_fmt = f"{utc_offset[:3]}:{utc_offset[3:]}"

        result = (
            f"Current time in {timezone}: "
            f"{now.strftime('%H:%M:%S')} on {now.strftime('%Y-%m-%d')} "
            f"(UTC{utc_offset_fmt})."
        )
        log.info("get_time: %s", result)
        return result

    except KeyError:
        log.error("get_time: unknown timezone '%s'", timezone)
        return f"Unknown timezone '{timezone}'. Use IANA names like 'America/New_York', 'Europe/London', 'Asia/Tokyo'."
    except Exception as e:
        log.error("get_time error: %s", e)
        return f"Time lookup failed: {e}"


def web_search(parameters: dict) -> str:
    """Search the web via OpenRouter + Perplexity Sonar."""
    query = parameters.get("query", "").strip()
    if not query:
        return "No search query provided."

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        log.warning("web_search: OPENROUTER_API_KEY not set")
        return "Web search is not configured. The OPENROUTER_API_KEY environment variable is not set."

    log.info("web_search: searching for '%s'", query)
    try:
        resp = http_requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json={
                "model": "perplexity/sonar",
                "messages": [
                    {
                        "role": "user",
                        "content": query,
                    }
                ],
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/lincohl",
                "X-Title": "Lincohl Voice Agent",
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        answer = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "No response received.")
        )
        log.info("web_search: got %d char response", len(answer))
        return answer

    except http_requests.exceptions.HTTPError as e:
        log.error("web_search HTTP error: %s", e)
        return f"Web search failed with HTTP error: {e}"
    except Exception as e:
        log.error("web_search error: %s", e)
        return f"Web search failed: {e}"


# ---------------------------------------------------------------------------
# Tool schemas (for ElevenLabs agent config)
# ---------------------------------------------------------------------------

TOOL_SCHEMAS = [
    {
        "type": "client",
        "name": "get_weather",
        "description": "Get current weather conditions for a location. Returns temperature, conditions, humidity, and wind speed.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name or location (e.g. 'London', 'Porto Alegre', 'Tokyo')",
                },
            },
            "required": ["location"],
        },
    },
    {
        "type": "client",
        "name": "get_time",
        "description": "Get the current time in a specific timezone. Use IANA timezone names.",
        "parameters": {
            "type": "object",
            "properties": {
                "timezone": {
                    "type": "string",
                    "description": "IANA timezone name (e.g. 'America/New_York', 'Europe/London', 'America/Sao_Paulo', 'Asia/Tokyo')",
                },
            },
            "required": ["timezone"],
        },
    },
    {
        "type": "client",
        "name": "web_search",
        "description": "Search the web for real-time information. Use for current events, facts, prices, news, or anything that needs up-to-date data.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query",
                },
            },
            "required": ["query"],
        },
    },
]

# ---------------------------------------------------------------------------
# Create a ClientTools instance with handlers registered
# ---------------------------------------------------------------------------

def create_client_tools():
    """Build a ClientTools instance with all tool handlers registered."""
    from elevenlabs.conversational_ai.conversation import ClientTools

    ct = ClientTools()
    ct.register("get_weather", get_weather)
    ct.register("get_time", get_time)
    ct.register("web_search", web_search)
    return ct
