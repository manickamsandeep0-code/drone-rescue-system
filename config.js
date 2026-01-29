/**
 * Environment Configuration
 * Store your API keys and sensitive configuration here
 * 
 * For production builds, set GEMINI_API_KEY as an EAS secret:
 * eas secret:create --name GEMINI_API_KEY --value "your-api-key"
 */

// Use environment variable if available (for EAS builds), otherwise use local key
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'AIzaSyDtdDKbVxCZFXJPGqK4QnDdFbVVqLf6JZY';

// Instructions for getting a Gemini API key:
// 1. Visit https://makersuite.google.com/app/apikey
// 2. Sign in with your Google account
// 3. Click "Create API Key"
// 4. Copy the key and replace 'YOUR_GEMINI_API_KEY_HERE' above
