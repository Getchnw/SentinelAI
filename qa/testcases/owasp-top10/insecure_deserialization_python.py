import pickle
import base64

def load_user_session(serialized_session_data):
    # Vulnerable: Insecure deserialization using pickle on untrusted user input
    session_bytes = base64.b64decode(serialized_session_data)
    session = pickle.loads(session_bytes)
    return session
