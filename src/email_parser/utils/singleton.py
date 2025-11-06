#!/usr/bin/env python3
"""
Singleton Metaclass

Provides a generic Singleton metaclass to ensure only one instance of a class
is ever created. This is used to prevent re-loading expensive resources, such
as the IAB Taxonomy, on every instantiation.
"""

from typing import Any

class Singleton(type):
    """
    A metaclass that creates a Singleton base class when called.
    """
    _instances: dict = {}

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        """
        Override the default __call__ behavior to implement the singleton pattern.
        
        If an instance of the class does not exist, it creates one and stores it.
        Subsequent calls will return the existing instance.
        """
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]
