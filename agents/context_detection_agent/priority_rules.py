HIGH_PRIORITY=[
    "bill",
    "payment",
    "doctor",
    "interview",
    "meeting",
    "exam"
]

LOW_PRIORITY=[
    "movie",
    "game",
    "music"
]

def detect_priority(task):
    task = task.lower()
    for word in HIGH_PRIORITY:
        if word in task:
            return "high"
    
    for word in LOW_PRIORITY:
        if word in task:
            return "low"
    
    return "medium"
