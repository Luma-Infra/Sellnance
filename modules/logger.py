# modules/logger.py
import logging
import sys
from datetime import datetime
import pytz


class KSTFormatter(logging.Formatter):
    """한국 표준시(KST) 기반 표준 로깅 포매터"""

    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, pytz.timezone("Asia/Seoul"))
        return dt.strftime(datefmt or "%Y-%m-%d %H:%M:%S")


def setup_logger(name="sellnance"):
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(KSTFormatter("[%(asctime)s] %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


logger = setup_logger()
