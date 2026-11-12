"""
Centralized Logging Infrastructure for CryptoTrace.

Provides structured, color-coded console logging with timestamps, log levels,
module paths, and line numbers for backend services and forensic pipelines.
"""
import os
import sys
import logging
from typing import Optional


class ColorizedFormatter(logging.Formatter):
    """Custom logging formatter adding ANSI color codes for enhanced readability."""

    # ANSI escape color codes
    GRAY = "\033[90m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    BOLD_RED = "\033[1;31m"
    RESET = "\033[0m"

    FORMAT = "%(asctime)s │ %(levelname)-8s │ %(name)s:%(lineno)d ─ %(message)s"
    DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

    LEVEL_COLORS = {
        logging.DEBUG: GRAY,
        logging.INFO: GREEN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: BOLD_RED,
    }

    def __init__(self, use_color: Optional[bool] = None):
        super().__init__(fmt=self.FORMAT, datefmt=self.DATE_FORMAT)
        if use_color is None:
            # Auto-detect whether output is an interactive terminal
            self.use_color = sys.stdout.isatty() or os.getenv("FORCE_COLOR", "0") == "1"
        else:
            self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        orig_levelname = record.levelname
        if self.use_color:
            color = self.LEVEL_COLORS.get(record.levelno, self.RESET)
            record.levelname = f"{color}{orig_levelname}{self.RESET}"

        formatted_msg = super().format(record)
        record.levelname = orig_levelname  # Reset so other handlers aren't affected
        return formatted_msg


_is_configured = False


def configure_logging(level: Optional[str] = None) -> None:
    """Configures root logger with colorized handler and calibrated log level."""
    global _is_configured
    if _is_configured:
        return

    log_level_str = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    numeric_level = getattr(logging, log_level_str, logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Avoid duplicate stream handlers
    if not any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(ColorizedFormatter())
        root_logger.addHandler(handler)

    _is_configured = True


def get_logger(name: str) -> logging.Logger:
    """
    Returns a configured logger instance for a given module.

    Usage:
        from core.logger import get_logger
        logger = get_logger(__name__)
        logger.info("Forensic scan initiated")
    """
    if not _is_configured:
        configure_logging()
    return logging.getLogger(name)
