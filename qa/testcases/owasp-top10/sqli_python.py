def get_user(conn, user_input):
    # 🛡️ นี่คือโค้ดจำลองที่ปลอดภัยแล้ว!
    query = 'SELECT * FROM users WHERE username = ?'
    return conn.execute(query, (user_input,))