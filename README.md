# CampusCare
Intelligent Campus Maintenance & Issue Prediction System

## Project Overview
Explain the campus maintenance problem and your solution.

## Features

### Student
- Report campus issues
- Track submitted reports
- View report status
- Receive notifications
- Manage profile

### Admin
- Monitor incidents
- Manage equipment
- View equipment health
- Risk ranking
- Maintenance hotspots
- Alerts
- Maintenance tracking

## Technology Stack

Frontend:
- React
- Vite
- Tailwind CSS
- React Router
- Recharts

Backend:
- FastAPI

Database:
- Redis

## Redis Architecture
- Hashes → Equipment
- Streams → Reports
- Sorted Sets → Risk ranking
- Sets → Categories/relationships
- Pub/Sub → Critical alerts
- TTL → Temporary data

## System Architecture

React → FastAPI → Redis

## Installation

### Frontend
npm install
npm run dev

### Backend
[partner's actual commands]

## Screenshots
[Add screenshots of your UI]

## Team Members
[Your names/roles]

## Future Improvements
...
