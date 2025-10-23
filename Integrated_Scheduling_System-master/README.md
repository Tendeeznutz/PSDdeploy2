# Project Title: Integrated Appointment Scheduling and Communication System - Air Conditioning Servicing Industry

## Description
The proposed project is a social enterprise effort aimed at empowering and supporting low-
income earners to become skilled technicians in the air conditioning servicing industry. The
project focuses on providing a platform for these individuals to access job servicing
opportunities within their locale, develop their skills, and improve their economic prospects.

__Tech Stack(s)__<br>
![React](https://img.shields.io/badge/React-%233399ff?logo=react&labelColor=%23000000)
![Django](https://img.shields.io/badge/Django-%233399ff?logo=django&labelColor=%23000000)
![tailwindcss](https://img.shields.io/badge/Tailwindcss-%2300cc44?logo=tailwindcss&labelColor=%23000000)
![antdesign](https://img.shields.io/badge/AntDesign-%23ff6666?logo=antdesign&labelColor=%23000000)
![materialdesign](https://img.shields.io/badge/MaterialDesign-%23009999?logo=materialdesign&labelColor=%23000000)<br>
![Sqlite](https://img.shields.io/badge/Sqlite-%23009933?logo=sqlite&labelColor=%23000000)
![Vercel](https://img.shields.io/badge/Vercel-%23000000?logo=vercel&labelColor=%23000000)
![Azure](https://img.shields.io/badge/Azure-%23b3ffff?logo=azuredevops&labelColor=%23000000)

# Table of Contents
1) [Installation Instructions](#1-installation-instructions)
2) [Pain Points](#2-pain-points-during-development)
3) [Limitations](#3-limitations)
4) [Future Works](#4-future-works)
5) [License](#5-license)
6) [Acknowledgement](#6-acknowledgement)
8) [Troubleshooting](#7-troubleshooting)
8) [Contact Information](#8-contact-information)
9) [Version History](#9-version-history)

# 1) Installation Instructions
## Backend
Assuming the Django backend is deployed in a single Ubuntu server as the only server.
### Prerequisition
1. Ubuntu Server with domain name
2. Gunicorn
3. Nginx
4. Git
5. Certbot (for HTTPS)
6. Compatible database (SQLite, PostgreSQL etc.)
### Clone the project into the server
```
git clone https://github.com/UofG-CS-2023/Integrated_Scheduling_System.git
```
### Adjust the project settings under settings.py
Modify the `ALLOWED_HOSTS`, `CORS_ORIGIN_WHITELIST` and `DATABASES` if needed.

### Install necessary dependencies (create venv if needed)
`pip install -r requirements.txt`

### Database migration
`python manage.py migrate`

### Configure Nginx to proxy pass to gunicorn
`sudo nano /etc/nginx/sites-available/Integrated-scheduling`
Before running Certbot
```
server {
    listen 80;
    server_name [your_domain_name];

    location = /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Run Certbot to enable HTTPS connection
`sudo certbot --nginx`
Follow the instruction

### Run the server
`sudo systemctl reload nginx`: reload nginx, or use restart

`pkill gunicorn`: terminate existing gunicorn

`cd [project_folder]/appointment_scheduling`: navigate to project directory

`screen`: start a screen session

`gunicorn --bind 127.0.0.1:8000 appointment_scheduling.wsgi:application`: run the server

resume the page with `screen -r` for next ssh session

# 2) Pain Points during development
- Benjamin Loh Choon How: Debugging issues on the frontend might be tricky as i need to look at both frontend and
  backend logs and sometimes the error code is not very helpful. The nature of the project also requires me to learn new
  technologies such as Django and ReactJS which is a steep learning curve. Designing the UI/UX is also a challenge as i
  have no prior experience in designing.
- Loo Siong Yu: Learning a new web framework while doing the project is not an easy task especially Django, while implementing
  new feature and debugging with the backend, I had to spent quite a number of hours to find out how does the backend code worked
  before finding the root cause of the bug. Between frontend and backend, I had challenges in both but UI/UX definitely make my top
  list because finding the right design, making the application responsive according to screen sizes is a huge challenge. But overall,
  it is a good learning experience while developing this product.  
- Neam Heng Chong Timothy: It was my first time using Django REST Framework and ReactJS and it was quite a huge challenge for me especially for the backend.
  There were some areas which I find it hard to understand and how these functions and files communicate with each other. Although I have some experience in UI/UX, 
  the frontend, ReactJS has a significant difference compared to other frontend. There was also another challenge for me where I do not understand how the 
  backend and frontend communicate with each other. This took me a long time to figure out. This has especially made debugging even harder for me to grasp. 
  However, it was a great learning experience learning Django and ReactJS.

# 3) Limitations
Due to the lack of time and experience, many features are not implemented or partially implemented. This section will address some of the important features missing in this project. 

#### Notification 

Notification features are not implemented at all despite of its importance. It provides timely updates, confirmations and reminders that improves user experience when using our website. Coordinators, technician and customers will all have a better time using our website if notifications were to be implemented. However, due to lack of time, we couldn’t implement it.  

#### Security 

Due to time constraints and the prioritization of getting the project deployed onto the cloud, only simple encryption of passwords was implemented as a security measure. While this approach provides a basic level of security by encrypting passwords before storing them in the database, other security measures could be implemented like JWT token authentication and CSRF token authentication for forms. 

#### Payment 

The implementation of payment features, including invoice, payslips has not been implemented at all in our project currently. Even though payment is a big aspect of our project, it has not been implemented due to time constraints. 

#### Appointment date time filtering 

Appointment date time filtering does not work as of now, perhaps due to the data being saved in UNIX timestamp format. As the filtering feature is implemented with the material-react-table library, there are some constraints on the features of the table that might have some relation to the difference in the actual data being iterated and how the data is being displayed on the table.  

#### Appointment service choices 

We have yet to allow customers to choose what type of services they require. All appointments right now are just general appointments, which allow us to test the matching algorithm for our technicians and customer. This appointments services feature will allow us for better pricing and payment system and more customization of our appointments, 

# 4) Future Works

#### Notification 

- Implement email and SMS notifications for appointments using Amazon SNS and cronjobs. Enhance automation by adding new jobs upon appointment creation and sending reminders.
- Automate appointment reminders to improve attendance and service efficiency, utilizing email and SMS notifications sent through Amazon SNS and cronjobs.

#### Security 

- Strengthen security with JWT for authentication and CSRF protection to prevent unauthorized requests. JWT securely transmits data, while CSRF protection mitigates unauthorized access risks.
- Enhance project security with JWT authentication and CSRF protection, safeguarding user data and preventing unauthorized access attempts.

#### Payment 

- Use Stripe APIs for secure payment processing and automated invoicing. Despite fees, Stripe offers robust fraud prevention and integration benefits.
- Optimize payment processing with Stripe APIs, ensuring secure transactions, fraud prevention, and streamlined invoicing for businesses and customers.

#### Appointment date time filtering 

- Explore alternative storage methods for DateTime data to improve compatibility with material-react-table filtering. Enhance filtering accuracy and functionality.
- Improve DateTime filtering by exploring alternative storage formats, ensuring seamless integration with material-react-table and enhancing user experience.

#### Appointment service choices 

- Allow users to specify service criteria like air conditioner brand and service type during appointment scheduling. Dynamically display appointments based on these criteria to prepare technicians effectively.
- Enhance appointment scheduling by enabling users to specify service criteria, ensuring technicians are adequately prepared and optimizing service delivery for customer satisfaction.
 
# 5) License


# 6) Acknowledgement
## Contributors:
Benjamin Loh Choon How - 2201590@sit.singaporetech.edu.sg

Wang Rongqi Richie - 2201942@sit.singaporetech.edu.sg

Neam Heng Chong Timothy - 2201291@sit.singaporetech.edu.sg 

Loo Siong Yu - 2201255@sit.singaporetech.edu.sg 

Lee Zheng Han - 2201085@sit.singaporetech.edu.sg 

Efilio Yodia Garcia - 2200516@sit.singaporetech.edu.sg 

## Libraries used:
Tailwind.css<br>
Ant Design<br>
Material-Tailwind<br>
Django RESTful API

# 7) Troubleshooting
## Common Issues

## Seeking help


# 8) Contact Information

Benjamin Loh Choon How - 2201590@sit.singaporetech.edu.sg

Wang Rongqi Richie - 2201942@sit.singaporetech.edu.sg

Neam Heng Chong Timothy - 2201291@sit.singaporetech.edu.sg 

Loo Siong Yu - 2201255@sit.singaporetech.edu.sg 

Lee Zheng Han - 2201085@sit.singaporetech.edu.sg 

Efilio Yodia Garcia - 2200516@sit.singaporetech.edu.sg 

# 9) Version History 
## Version 1.0.0
