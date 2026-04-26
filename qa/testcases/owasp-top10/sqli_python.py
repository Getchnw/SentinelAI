# Vulnerable SQL injection sample

def get_user(conn, user_input):
    query = "SELECT * FROM users WHERE username = '" + user_input + "'"
    return conn.execute(query)
