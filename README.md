# Titanium Dashboard

Titanium Dashboard is a modern, cross-platform stock tracking dashboard. Built
using Electron, React, and TypeScript, it offers a beautifully
designed interface with glassmorphism and a premium dark mode aesthetic.
Real-time stock data is seamlessly fetched using `yahoo-finance2` via IPC to
bypass browser CORS constraints, providing accurate, reliable market data.

## Features

- **Real-time Data**: Fetch the latest quotes without limits using Yahoo
Finance.
- **Titanium Aesthetics**: Enjoy a beautifully designed, premium user interface
with interactive "burnt titanium" highlights.
- **Cross-platform**: Readily packages for both Windows and Mac using
electron-builder.
- **Local Persistence**: Saves your settings and ticker list locally without
needing a database.
- **Customizable Defaults**: Define default stocks through an environment
variable.

## Customizing Default Stocks

You can customize the default list of stocks loaded on the first run (or when resetting storage) by using an environment variable.

1. Create a `.env` file in the root of the project.
2. Add the `STOCKS` variable with a comma-separated list of ticker symbols:

```env
STOCKS=AAPL,GOOGL,NVDA,AMD,INTC
```

When you start (`npm run dev`) or build the app, it will read this variable and
use those tickers as your default dashboard!

## Requirements

- Node.js (22 or newer recommended)
- npm (Node Package Manager)

## Installation Instructions

1. **Clone the repository** (or download and extract the project):

    ```bash
    git clone git@github.com:Marketionist/titanium-dashboard.git
    cd titanium-dashboard
    ```

2. **Install dependencies**:
   Run the following command in the project root to install all necessary
   packages:

    ```bash
    npm install
    ```

3. **Start the development server**:
   To run the app locally with hot-module replacement, execute:
    ```bash
    npm run dev
    ```

## Building Instructions

The app is built using `electron-builder` which allows for generating highly
optimized executables for different operating systems. Below are the commands
you can use to package the app.

### macOS Build

To package the application as a macOS `.dmg` installer:

```bash
npm run build:mac
```

The compiled disk image and raw binaries will be located under the `release/`
directory.

### Windows Build

To package the application as a Windows `.exe` installer (using NSIS):

```bash
npm run build:win
```

The compiled installer will be located under the `release/` directory.

### General Build

If you want to run a complete build pipeline without a specific flag (defaults
to your current operating system host):

```bash
npm run build
```

## Technologies Used

- **Frameworks**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [Vite](https://vitejs.dev/)
- **Languages**: TypeScript
- **Styling**: Vanilla CSS (CSS Variables, Flexbox/Grid, Animations)
- **APIs**: [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2)
- **Icons**: [Heroicons](https://heroicons.com/)

## Thanks
If this app was helpful to you - please give this repository a **★ Star** on
[GitHub](https://github.com/Marketionist/titanium-dashboard).
