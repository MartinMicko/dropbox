provider "aws" {
  region = "eu-central-1"
}

# Create a Web VPC
resource "aws_vpc" "dropbox_web_vpc" {
  cidr_block = "10.10.0.0/16"

  tags = {
    Name = "Dropbox_Web_VPC"
  }
}

# Create a Database VPC
resource "aws_vpc" "dropbox_db_vpc" {
  cidr_block = "10.20.0.0/16"

  tags = {
    Name = "Dropbox_DB_VPC"
  }
}

# Create a Public Subnet in the Web VPC
resource "aws_subnet" "dropbox_public_subnet" {
  vpc_id                  = aws_vpc.dropbox_web_vpc.id
  cidr_block              = "10.10.1.0/24"
  map_public_ip_on_launch = true

  availability_zone = "eu-central-1a"  # First Availability Zone

  tags = {
    Name = "Dropbox_Public_Subnet"
  }
}

# Create Private Subnets in the DB VPC across multiple AZs
resource "aws_subnet" "dropbox_db_private_subnet_a" {
  vpc_id                  = aws_vpc.dropbox_db_vpc.id
  cidr_block              = "10.20.1.0/24"
  map_public_ip_on_launch = false

  availability_zone = "eu-central-1a"  # First Availability Zone

  tags = {
    Name = "Dropbox_DB_Private_Subnet_A"
  }
}

resource "aws_subnet" "dropbox_db_private_subnet_b" {
  vpc_id                  = aws_vpc.dropbox_db_vpc.id
  cidr_block              = "10.20.2.0/24"
  map_public_ip_on_launch = false

  availability_zone = "eu-central-1b"  # Second Availability Zone

  tags = {
    Name = "Dropbox_DB_Private_Subnet_B"
  }
}

# Create an Internet Gateway for the Web VPC
resource "aws_internet_gateway" "dropbox_igw" {
  vpc_id = aws_vpc.dropbox_web_vpc.id

  tags = {
    Name = "Dropbox_Internet_Gateway"
  }
}

# Create a Route Table for the Public Subnet in the Web VPC
resource "aws_route_table" "dropbox_public_rt" {
  vpc_id = aws_vpc.dropbox_web_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dropbox_igw.id
  }

  tags = {
    Name = "Dropbox_Public_Route_Table"
  }
}

# Associate the Route Table with the Public Subnet
resource "aws_route_table_association" "dropbox_public_rt_assoc" {
  subnet_id      = aws_subnet.dropbox_public_subnet.id
  route_table_id = aws_route_table.dropbox_public_rt.id
}

# Create a Security Group for the Web Server
resource "aws_security_group" "dropbox_web_sg" {
  vpc_id = aws_vpc.dropbox_web_vpc.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] 
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Dropbox_Web_Security_Group"
  }
}

# Create a Security Group for the Database
resource "aws_security_group" "dropbox_db_sg" {
  vpc_id = aws_vpc.dropbox_db_vpc.id

  ingress {
    from_port   = 3306 
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.dropbox_web_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Dropbox_DB_Security_Group"
  }
}

# VPC Peering Connection between Web VPC and DB VPC
resource "aws_vpc_peering_connection" "dropbox_vpc_peering" {
  vpc_id      = aws_vpc.dropbox_web_vpc.id
  peer_vpc_id = aws_vpc.dropbox_db_vpc.id
  auto_accept = true
}

# Add Peering Connection Route to Web VPC Route Table
resource "aws_route" "web_to_db_peering_route" {
  route_table_id         = aws_route_table.dropbox_public_rt.id
  destination_cidr_block = aws_vpc.dropbox_db_vpc.cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.dropbox_vpc_peering.id
}

# Add Peering Connection Route to DB VPC Route Table
resource "aws_route_table" "dropbox_db_private_rt" {
  vpc_id = aws_vpc.dropbox_db_vpc.id

  route {
    cidr_block = aws_vpc.dropbox_web_vpc.cidr_block
    vpc_peering_connection_id = aws_vpc_peering_connection.dropbox_vpc_peering.id
  }

  tags = {
    Name = "Dropbox_DB_Private_Route_Table"
  }
}

# Associate the Route Table with the Private Subnets in the DB VPC
resource "aws_route_table_association" "db_private_rt_assoc_a" {
  subnet_id      = aws_subnet.dropbox_db_private_subnet_a.id
  route_table_id = aws_route_table.dropbox_db_private_rt.id
}

resource "aws_route_table_association" "db_private_rt_assoc_b" {
  subnet_id      = aws_subnet.dropbox_db_private_subnet_b.id
  route_table_id = aws_route_table.dropbox_db_private_rt.id
}

# Create a DB Subnet Group for the RDS instance (include both private subnets)
resource "aws_db_subnet_group" "dropbox_db_subnet_group" {
  name       = "dropbox-db-subnet-group"
  subnet_ids = [
    aws_subnet.dropbox_db_private_subnet_a.id,
    aws_subnet.dropbox_db_private_subnet_b.id,
  ]

  tags = {
    Name = "Dropbox_DB_Subnet_Group"
  }
}

# Get the latest Ubuntu AMI
data "aws_ami" "latest_ubuntu" {
  most_recent = true
  
  filter {
    name   = "name"
    values = ["ubuntu*-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["amazon"]  # Official Ubuntu AMIs
}

# Create an EC2 Instance with dynamic Ubuntu AMI in the Web VPC
resource "aws_instance" "dropbox_web_instance" {
  ami                    = data.aws_ami.latest_ubuntu.id
  instance_type         = "t3.micro"
  subnet_id             = aws_subnet.dropbox_public_subnet.id
  vpc_security_group_ids = [aws_security_group.dropbox_web_sg.id]
  key_name              = "dropbox_key"  

  tags = {
    Name = "Dropbox_WebServer"
  }
}

# Create an RDS Database instance in the DB VPC (replace with actual values)
resource "aws_db_instance" "dropbox_db_instance" {
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "mysql"
  engine_version       = "8.0"
  instance_class       = "db.t3.micro"
  db_name              = "dropbox_db"
  username             = "admin"
  password             = "adminpassword" 
  vpc_security_group_ids = [aws_security_group.dropbox_db_sg.id]
  db_subnet_group_name = aws_db_subnet_group.dropbox_db_subnet_group.name  # Reference to DB subnet group
  multi_az             = true  # Enable Multi-AZ for high availability
  publicly_accessible  = false
  skip_final_snapshot  = true  # enable in future

  tags = {
    Name = "Dropbox_DB_Instance"
  }
}

#   Outputs for script
output "ec2_public_ip" {
  value       = aws_instance.dropbox_web_instance.public_ip
  description = "The public IP of the EC2 instance for Ansible inventory."
}

output "db_endpoint" {
  value       = aws_db_instance.dropbox_db_instance.address
  description = "The endpoint address of the RDS MySQL instance."
}
