import boto3

def upload_to_s3(file_path, bucket_name, object_name):
    # Vulnerable: Hardcoded AWS Credentials
    aws_access_key_id = "AKIAQWX7E9P2Z4M8K5LT"
    aws_secret_access_key = "z7XkP9vQw2mR4bT8yN1oA5sD6fG3hJ0kL7xV2uB"

    s3_client = boto3.client(
        's3',
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        region_name="us-east-1"
    )
    
    s3_client.upload_file(file_path, bucket_name, object_name)