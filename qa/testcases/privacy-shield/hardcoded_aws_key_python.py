import boto3

def upload_to_s3(file_path, bucket_name, object_name):
    # Vulnerable: Hardcoded AWS Credentials
    aws_access_key_id = "AKIAIOSFODNN7EXAMPLE"
    aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

    s3_client = boto3.client(
        's3',
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        region_name="us-east-1"
    )
    
    s3_client.upload_file(file_path, bucket_name, object_name)