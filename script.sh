#!/bin/bash

sudo chmod 400 ~/builds/QiPb2HGmb/0/I530019/dropbox/dropbox_key.pem
sudo chown ubuntu:ubuntu ~/builds/QiPb2HGmb/0/I530019/dropbox/dropbox_key.pem
# SSH into the instance and run commands
ssh -i ~/builds/QiPb2HGmb/0/I530019/dropbox/dropbox_key.pem ubuntu@54.93.125.82 << 'EOF'

# Update and upgrade apt packages
sudo apt update && sudo apt upgrade -y

# Install rsync (for synchronize module)
sudo apt install -y rsync

# Synchronize the "dropbox" folder to the instance
rsync -avz --chmod=0755 ./ /home/dropbox/

# Install MySQL client
sudo apt install -y mysql-client

# Install Node.js
sudo apt install -y nodejs

# Install npm
sudo apt install -y npm

# Install bcrypt (for password hashing)
npm install bcrypt --prefix /home/dropbox/

# Install required npm packages
npm install --prefix /home/dropbox/

# Install AWS SDK package using npm
npm install aws-sdk --prefix /home/dropbox/

# Start Node.js application
cd /home/dropbox/
node app.js

EOF
