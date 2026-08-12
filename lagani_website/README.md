# Lagani App - Marketing Website

This project is a single-page marketing website for the Lagani mobile app (a Nepal finance/stock tracking application).

## Goal

To create a modern, visually appealing landing page that:
- Showcases the Lagani app within an iPhone mockup.
- Highlights key features of the app.
- Provides prominent download links for the App Store and Google Play.
- Utilizes animations and modern UI components for an engaging user experience.
- Implements a dark theme by default.

## Tech Stack

- **Framework**: Next.js (v14+ with App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components & Animations**: [magic-ui](https://magicui.design/) (integrated via `shadcn/ui` CLI)
- **Font**: Manrope (from Google Fonts)

## Key Components Used (from magic-ui)

- `Iphone15Pro`: For displaying the app screenshot.
- `ColoredGridPattern`: For the animated background effect with stock market colors.
- `WordRotate`: For the main headline rotation.
- `ShimmerButton`: For download buttons.
- `Marquee`: For scrolling stock symbols.

## Completed Features

- Responsive design that works on mobile, tablet, and desktop
- Animated colored grid background using client-side rendering to avoid hydration issues
- Rotating headlines with fixed height container to prevent layout shifts
- Feature cards with purple background highlighting key app features
- "Last Traded Price" marquee showing stock symbols
- Interactive download buttons with app store icons
- Modern, clean dark-themed UI that highlights the app's functionality

## Project Structure

```
lagani_website/
├── public/             # Static assets (e.g., lagani_logo.png, app_home.png)
├── src/
│   ├── app/            # Next.js App Router files
│   │   ├── globals.css # Global styles, Tailwind directives, CSS variables (theme)
│   │   ├── layout.tsx  # Root layout, font setup, metadata
│   │   └── page.tsx    # Main page component
│   ├── components/     # UI components
│   │   ├── magicui/    # Components added via shadcn/magic-ui
│   │   ├── ui/         # Components added via shadcn/ui (e.g., button)
│   │   └── client-grid-pattern.tsx # Client component wrapper for ColoredGridPattern
│   └── lib/            # Utility functions (e.g., cn from shadcn)
├── tailwind.config.ts  # Tailwind CSS configuration
├── next.config.ts      # Next.js configuration
├── package.json        # Project dependencies and scripts
└── ...                 # Other config files (tsconfig, postcss, etc.)
```

## Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- npm or yarn

### Installation & Running

1.  **Clone the repository** (if you haven't already).
2.  **Navigate to the project directory**:
    ```bash
    cd lagani_website
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    # or
    # yarn install
    ```
4.  **Place assets**: Ensure the `lagani_logo.png` and `app_home.png` files are present in the `public/` directory.
5.  **Run the development server**:
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
6.  Open [http://localhost:3000](http://localhost:3000) (or the specified port) in your browser.

## Current Status

- ✅ Fully implemented responsive layout 
- ✅ Hydration issues fixed with proper client/server component separation
- ✅ ESLint errors resolved for production builds
- ✅ Consistent styling with purple theme for feature cards
- ✅ Fixed layout shifts by adding minimum height containers
- ✅ Stock market colored grid animation (green/red)
- ✅ App screenshot displayed in iPhone 15 Pro mockup
- ✅ Bold feature headings and proper button styling

## Build and Deploy

To build the website for production:

```bash
npm run build
```

The site can be deployed to Vercel, Netlify, or any other platform that supports Next.js applications.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.