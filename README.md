# Juvo - Service Platform

Juvo is a lightweight web platform for connecting service providers with users, built with Node.js/Express and a simple HTML/CSS front-end. It's an ideal starting point for building a local services directory, a professional services marketplace, or an internal tool for managing company services.

[![build status](https://img.shields.io/badge/build-pending-lightgrey)](https://github.com/actions)
[![node](https://img.shields.io/badge/node-18.x-blue)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Features

-   **Service Listings**: Display and manage a directory of available services.
-   **Provider Profiles**: Allow service providers to create and manage their profiles.
-   **User Management**: Secure user registration and login.
-   **Admin Dashboard**: Basic admin routes for user and service management.
-   **File Uploads**: A simple system for handling profile pictures or other media.
-   **Data Migration & Seeding**: Includes scripts to seed your database and migrate from SQL to MongoDB.
-   **Minimalist & Extendable**: A straightforward codebase that is easy to read, customize, and build upon.

## Tech Stack

-   **Backend**: Node.js, Express
-   **Frontend**: HTML, CSS, Vanilla JavaScript
-   **Database**: SQLite (default), with scripts for MongoDB migration.

## Quick Start

To get a local copy up and running, follow these steps.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18.x or later recommended)
-   npm (comes with Node.js)

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone <your-repository-url>
    cd <your-repository-name>
    ```

2.  **Install server dependencies:**
    ```powershell
    cd server
    npm install
    ```

3.  **Configure Environment Variables:**

    Create a `.env` file inside the `server` directory and add the following variables. Replace the placeholder values with your own.

    ```env
    PORT=3000
    # Use a strong, randomly generated string for production
    JWT_SECRET=your_jwt_secret_key
    # Example for SQLite
    DATABASE_URL=../data/juvo.db
    ```

4.  **Seed the Database (Optional):**

    To populate the database with initial data, run the seed script from the `server` directory:
    ```powershell
    node .\scripts\seed-sql.js
    ```

5.  **Start the Server:**
    ```powershell
    npm start
    ```
    The server will start on `http://localhost:3000`.

## Contributing

Contributions are welcome! If you have a suggestion or find a bug, please open an issue to discuss it.

To contribute code:
1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.
