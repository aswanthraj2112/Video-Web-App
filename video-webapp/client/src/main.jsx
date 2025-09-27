import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App.jsx';
import DevApp from './DevApp.jsx';
import './styles.css';

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;
// Force development mode since we're using local mock services
const hasValidCognito = false; // Set to true when using real AWS Cognito
const forceDevMode = true; // Override for development

console.log('Environment check:', {
  isDevelopment,
  hasValidCognito,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID
});

// Configure Amplify with proper error handling
let amplifyConfigured = false;
if (hasValidCognito) {
  try {
    Amplify.configure({
      API: {
        endpoints: [
          {
            name: 'videoApi',
            endpoint: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
          }
        ]
      },
      Auth: {
        region: import.meta.env.VITE_AWS_REGION || 'ap-southeast-2',
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolWebClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        mandatorySignIn: false
      }
    });
    amplifyConfigured = true;
    console.log('✅ Amplify configured successfully');
  } catch (error) {
    console.warn('⚠️ Amplify configuration failed:', error);
  }
} else {
  console.log('🚧 Running in development mode without Cognito');
}

// Render the appropriate application
try {
  console.log('Starting React application...');
  const root = ReactDOM.createRoot(document.getElementById('root'));
  
  // Use DevApp if in development mode or forced development mode
  const AppComponent = (forceDevMode || (isDevelopment && !hasValidCognito)) ? DevApp : App;
  
  root.render(
    <React.StrictMode>
      <AppComponent />
    </React.StrictMode>
  );
  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ Error rendering React app:', error);
  // Fallback: render a simple error message
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="color: white; padding: 20px; font-family: Arial, sans-serif; background-color: #0f172a; min-height: 100vh;">
        <h1>❌ Application Error</h1>
        <p>There was an error loading the application. Check the console for details.</p>
        <pre style="background: #333; padding: 10px; border-radius: 4px; color: #ff6b6b;">${error.message}</pre>
        <p style="margin-top: 20px;">Stack trace:</p>
        <pre style="background: #333; padding: 10px; border-radius: 4px; font-size: 12px;">${error.stack}</pre>
      </div>
    `;
  }
}
