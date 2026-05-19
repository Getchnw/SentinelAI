import subprocess

def ping_host(user_input):
    # Vulnerable: Command injection via shell=True and f-string
    command = f"ping -c 1 {user_input}"
    result = subprocess.check_output(command, shell=True, text=True)
    return result

if __name__ == "__main__":
    host = input("Enter host to ping: ")
    try:
        output = ping_host(host)
        print(output)
    except subprocess.CalledProcessError as e:
        print(f"Ping failed: {e}")
