import dateparser 

def normalize_datetime(text):
    if not text:
        return ""
    parsed = dateparser.parse(text)
    if parsed:
        return parsed.isoformat()
    
    return ""