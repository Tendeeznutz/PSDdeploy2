# Project Title: Integrated Appointment Scheduling and Communication System - Air Conditioning Servicing Industry

## Description
This project serves as the frontend web application for the proposed project that is a social enterprise effort aimed at empowering and supporting low-
income earners to become skilled technicians in the air conditioning servicing industry. The project focuses on providing a platform for these individuals to access job servicing
opportunities within their locale, develop their skills, and improve their economic prospects.

## Table of Contents
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Routes](#routes)
- [Folder Structure](#folder-structure)
- [Components](#components)
- [Data](#data)
- [Technologies](#technologies)
- [Deployment](#deployment)
- [License](#license)
- [Authors](#authors)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/UofG-CS-2023/Integrated_Scheduling_System.git
   ```
   
2. Navigate to the project directory
   ```bash
   cd appointment_scheduling/frontend
   ```

3. Install the dependencies
   ```bash
    npm install
    ```
   
4. Start the development server
    ```bash
   npm start
   ```
   
5. Open [http://localhost:3000](http://localhost:3000) with your browser to view landing page.

### Routes
- `/` - Landing page which is the login page of the application.
- `/login` - Login page is the login page of the application that caters to customers, technicians and coordinators.
- `/register` - Register page is the registration page of the application that caters to customers.
- `/home` - Home page which serves as the customer's home page of the application.
- `/scheduleAppointment` - Schedule Appointment page is the page where customers can schedule an appointment.
- `/CustomerEnquiry` - Customer Enquiry page where coordinators can send ad hoc enquiry emails to customers of specific appointments.
- `/profile` - Profile page is the profile page of the application that caters to customers.
- `/appointmentDetail` - Appointment Detail page is the page where customers can view the details of their appointment.
- `/RegisterTechnician` - Register Technician page is the registration page of the application that caters to technicians that is done by a coordinator.
- `/TechnicianList` - Technician List page is the page where coordinators can view the list of technicians.
- `/TechnicianProfile` - Technician Profile page is the profile page of the application that caters to technicians.
- `/coordinatorHome` - Coordinator Home page is the home page of the application that caters to coordinators.
- `/CoordinatorAppointmentView` - Coordinator Appointment View page is the page where coordinators can view the details of appointments.
- `/CoordinatorAppointmentUpdate` - Coordinator Appointment Update page is the page where coordinators can update the details of appointments.
- `/TechnicianHome` - Technician Home page is the home page of the application that caters to technicians.
- `/AirconCatalog` - Aircon Catalog page is the page where coordinators can view and add to the list of air conditioners.
- `/error` - Error page is the error page of the application that caters to all users.
- `*` - This is a wildcard route that catches all other routes not defined above. It renders the error page.

## Folder Structure
The project is structured as follows:
```
appointment_scheduling/frontend
├── public
├── src
│   ├── asset
│   │   ├── img
│   ├── components
│   ├── pages
│   ├── App.js
│   ├── index.js
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── tailwind.config.js
```

## Components

- `BackgroundWallpaper` - This component is used to display the background wallpaper of the application.
- `CoordinatorNavbar` - This component is used to display the navigation bar of the application for coordinators.
- `navbar` - This component is used to display the navigation bar of the application for customers and technicians.

## Data

Data is grabbed from the backend django API and is used to populate the application with the necessary information.

## Technologies
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Axios](https://axios-http.com/)
- [Ant Design](https://ant.design/)

## Deployment

This project can be deployed using [Vercel](https://vercel.com/), a platform built by the creators of Next.js. Vercel makes it easy to deploy React applications and provides a live URL.

### Steps for Deployment

1. **Create a Vercel Account**: If you don't have a Vercel account, go to [Vercel](https://vercel.com/signup) and sign up.

2. **Import Your Project**: After logging in, click on the "Import Project" button on the Vercel dashboard. You can either import your project from a Git repository or from a template.

3. **Configure Your Project**: After importing your project, you'll be asked to configure your project. You can choose the project name, the settings, and the environment variables.

4. **Deploy Your Project**: After configuring your project, click on the "Deploy" button. Vercel will build and deploy your application. Once the deployment is done, Vercel will provide you with a unique URL for your deployed application.

Remember to add any environment variables your project needs in the Vercel dashboard.

For more detailed information, refer to the [Vercel documentation](https://vercel.com/docs).



## License

## Authors
Benjamin Loh Choon How - 2201590@sit.singaporetech.edu.sg

Wang Rongqi Richie - 2201942@sit.singaporetech.edu.sg

Neam Heng Chong Timothy - 2201291@sit.singaporetech.edu.sg

Loo Siong Yu - 2201255@sit.singaporetech.edu.sg

Lee Zheng Han - 2201085@sit.singaporetech.edu.sg

Efilio Yodia Garcia - 2200516@sit.singaporetech.edu.sg 