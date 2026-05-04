import subprocess


def ping_host(user_input: str) -> str:
    # Vulnerable: user input is passed to shell command directly.
    command = f"ping -c 1 {user_input}"
    result = subprocess.check_output(command, shell=True, text=True)
    return result


if __name__ == "__main__":
    host = input("Host: ")
    print(ping_host(host))
