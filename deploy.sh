#!/bin/bash

# Step 1: Initialize and Apply Terraform
echo "Initializing Terraform..."
terraform init
echo "Applying Terraform configuration..."
terraform apply -auto-approve

# Step 2: Capture Outputs from Terraform
echo "Fetching Terraform outputs..."
EC2_PUBLIC_IP=$(terraform output -raw ec2_public_ip)
DB_ENDPOINT=$(terraform output -raw db_endpoint)

# Step 3: Generate Ansible Inventory File
echo "Creating inventory.ini file..."
cat <<EOF > inventory.ini
[Linux]
ec2_instance ansible_host=$EC2_PUBLIC_IP

[Linux:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=./dropbox_key.pem
db_host=$DB_ENDPOINT
db_user=admin
db_pass=adminpassword
EOF

# Step 4: Generate Config.json File for Sensitive Data
echo "Creating config.json file..."
cat <<EOF > config.json
{
  "AWS": {
    "access_key_id": "AKIA4LLE7KKGTHOY4IWP",
    "secret_access_key": "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",
    "region": "eu-central-1",
    "bucket_name": "prototype-dopbox"
  },
  "Database": {
    "host": "$DB_ENDPOINT",
    "user": "admin",
    "password": "adminpassword",
    "database": "dropbox_db"
  },
  "Session": {
    "secret": "keyboard cat"
  }
}
EOF

# Step 5: Secure Sensitive Files
echo "Securing sensitive files..."
chmod 600 config.json
chmod 400 dropbox_key.pem

# Step 6: Run Ansible Playbook
echo "Running Ansible playbook to configure EC2 instance and set up MySQL client..."
ansible-playbook -i inventory.ini manage_ec2_instances.yml

