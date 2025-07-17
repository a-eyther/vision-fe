# Project Theia - Hospital Revenue Analytics Dashboard

A powerful React-based dashboard application by Eyther that transforms hospital claims data into comprehensive revenue analytics, denial pattern insights, and ROI optimization tools.

## Features

- **CSV Upload**: Drag-and-drop interface for uploading GenericSearchReport CSV files
- **Interactive Dashboard**: Real-time charts and statistics
- **Data Analytics**: 
  - Claims trends over time
  - Hospital performance analysis
  - Specialty distribution
  - Patient demographics (age, gender)
  - Geographic distribution
  - Financial insights (amounts, approval rates)
- **Export Functionality**: Download processed data as CSV
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and go to `http://localhost:5173`

## Usage

1. **Upload CSV File**: 
   - Drag and drop your GenericSearchReport CSV file onto the upload area
   - Or click to browse and select the file
   - The file should contain the required columns: TID, Patient Name, Hospital Name, Status, Approved Amount, etc.

2. **View Dashboard**:
   - Once uploaded, the dashboard will automatically generate
   - Explore different charts and statistics
   - Use the export button to download filtered data

3. **Sample Data**:
   - A sample `GenericSearchReport.csv` file is included in the `public` directory for testing

## CSV Format Requirements

The CSV file should contain the following columns:
- TID (Transaction ID)
- Patient Name
- Hospital Code
- Hospital Name
- Hospital Type
- Date of Admission
- Date of Discharge
- Pkg Code
- Pkg Name
- Pkg Rate
- Status
- Approved Amount
- Paid Amount
- Gender
- Age
- District Name
- Pkg Speciality Name
- And other healthcare claims related fields

## Technology Stack

- **React 19.1.0** - UI framework
- **Vite 6.2.0** - Build tool
- **TailwindCSS 4.0.17** - Styling
- **Recharts 2.15.1** - Charts and data visualization
- **React Dropzone 14.3.8** - File upload
- **Lucide React 0.487.0** - Icons
- **Date-fns 4.1.0** - Date utilities
- **React Toastify 11.0.5** - Notifications

## Dashboard Components

### Statistics Cards
- Total Claims Count
- Total Approved Amount
- Claims Paid Count
- Average Claim Amount

### Charts
- **Line Chart**: Monthly claims trends
- **Bar Charts**: Top hospitals, specialties, districts
- **Pie Charts**: Age groups, gender distribution

### Data Processing
- Intelligent date parsing for various formats
- Currency formatting for Indian Rupees
- Statistical calculations for approval rates
- Data filtering and export capabilities

## Design System

The application follows the Eyther brand design system with:
- Custom blue color scheme (#2A5EB4)
- Consistent typography (Nunito Sans, Roboto)
- Responsive grid layouts
- Accessible UI components

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Contributing

1. Follow the existing code style and component patterns
2. Ensure responsive design principles
3. Test with sample CSV data
4. Update documentation as needed

## License

This project is for internal use and follows the existing Eyther project licensing.# project-theia
