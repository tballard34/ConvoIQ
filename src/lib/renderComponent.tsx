/**
 * Dynamic Component Renderer
 * Transforms JSX UI code into executable React components at runtime
 */

// @ts-ignore - No types available for @babel/standalone
import * as Babel from '@babel/standalone';
import React from 'react';

/**
 * Transform JSX code to plain JavaScript using Babel
 */
function transformJSX(uiCode: string): string {
  try {
    const transformed = Babel.transform(uiCode, {
      presets: ['react'],
      filename: 'component.jsx',
    });
    return transformed.code || '';
  } catch (error: any) {
    console.error('❌ JSX transformation failed:', error);
    throw new Error(`Failed to transform JSX: ${error.message}`);
  }
}

/**
 * Extract function name from UI code
 * Example: "function CallSummary({ data })" → "CallSummary"
 */
function extractFunctionName(uiCode: string): string {
  const match = uiCode.match(/function\s+(\w+)/);
  if (!match || !match[1]) {
    throw new Error('Could not find function name in UI code');
  }
  return match[1];
}

/**
 * Render a component from UI code string with generated data
 * 
 * @param uiCode - The JSX function code as a string (e.g., "function CallSummary({ data }) { ... }")
 * @param data - The generated data to pass to the component
 * @returns React element
 */
export function renderComponent(uiCode: string, data: any): React.ReactElement {
  try {
    console.log('🎨 Rendering component with data:', data);

    // Step 1: Transform JSX to plain JS
    const transformedCode = transformJSX(uiCode);
    console.log('✅ JSX transformed to JS');

    // Step 2: Extract function name
    const functionName = extractFunctionName(uiCode);
    console.log(`📦 Component name: ${functionName}`);

    // Step 3: Create the component function
    // We need to provide React in scope for the transformed code
    const componentFunction = new Function('React', 'data', `
      ${transformedCode}
      return ${functionName}({ data });
    `);

    // Step 4: Execute the function with React and data
    const element = componentFunction(React, data);
    
    console.log('✅ Component rendered successfully');
    return element;

  } catch (error: any) {
    console.error('❌ Component rendering failed:', error);
    
    // Return error UI
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-red-900">
          Component Rendering Error
        </h3>
        <p className="text-sm text-red-700">{error.message}</p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-red-800">
            Show Details
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs text-red-900">
            {error.stack || error.toString()}
          </pre>
        </details>
      </div>
    );
  }
}

/**
 * Component wrapper that handles async data fetching and rendering
 */
export interface DynamicComponentProps {
  uiCode: string;
  generatedDataJson: string;
}

export function DynamicComponent({ uiCode, generatedDataJson }: DynamicComponentProps) {
  try {
    // Parse the JSON data
    const data = JSON.parse(generatedDataJson);
    
    // Render the component
    return renderComponent(uiCode, data);
  } catch (error: any) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-red-900">
          Failed to Parse Generated Data
        </h3>
        <p className="text-sm text-red-700">{error.message}</p>
      </div>
    );
  }
}

