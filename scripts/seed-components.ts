import fetch from 'node-fetch';
import type { Component } from '../src/types/schema.js';

const HARPERDB_URL = process.env.HARPERDB_URL || 'http://localhost:9926';
const HARPERDB_USERNAME = process.env.HARPERDB_USERNAME || '';
const HARPERDB_PASSWORD = process.env.HARPERDB_PASSWORD || '';

// Example LLM component
const exampleLLMComponent: Component = {
  id: 'comp-llm-001',
  component_name: 'Call Summary',
  component_type: 'llm',
  prompt: 'Provide a 3-sentence summary of this call, highlighting the key topics discussed and any action items.',
  code: '', // Not used for LLM components
  structuredOutput: JSON.stringify({
    type: 'object',
    properties: {
      summary: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3
      }
    },
    required: ['summary']
  }),
  uiCode: `
function CallSummary({ data }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-xl font-semibold text-gray-900">Call Summary</h3>
      <div className="space-y-3">
        {data.summary.map((sentence, idx) => (
          <p key={idx} className="text-gray-700">{sentence}</p>
        ))}
      </div>
    </div>
  );
}
  `.trim(),
  createdAt: new Date().toISOString()
};

// Example code component
const exampleCodeComponent: Component = {
  id: 'comp-code-001',
  component_name: 'Speaker Time Analysis',
  component_type: 'code',
  prompt: '', // Not used for code components
  code: `
function analyzeTranscript(wordLevelTranscript) {
  const speakerTimes = {};
  
  wordLevelTranscript.forEach(word => {
    const speaker = word.speaker || 'Unknown';
    const duration = (word.end - word.start) || 0;
    
    if (!speakerTimes[speaker]) {
      speakerTimes[speaker] = 0;
    }
    speakerTimes[speaker] += duration;
  });
  
  const total = Object.values(speakerTimes).reduce((a, b) => a + b, 0);
  
  const result = Object.entries(speakerTimes).map(([speaker, time]) => ({
    speaker,
    timeSeconds: Math.round(time),
    percentage: Math.round((time / total) * 100)
  }));
  
  return { speakers: result };
}
  `.trim(),
  structuredOutput: JSON.stringify({
    type: 'object',
    properties: {
      speakers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            speaker: { type: 'string' },
            timeSeconds: { type: 'number' },
            percentage: { type: 'number' }
          }
        }
      }
    },
    required: ['speakers']
  }),
  uiCode: `
function SpeakerTimeAnalysis({ data }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-xl font-semibold text-gray-900">Speaker Time</h3>
      <div className="space-y-4">
        {data.speakers.map(speaker => (
          <div key={speaker.speaker}>
            <div className="mb-1 flex justify-between">
              <span className="font-medium text-gray-700">{speaker.speaker}</span>
              <span className="text-gray-600">{speaker.timeSeconds}s ({speaker.percentage}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div 
                className="h-2 rounded-full bg-gray-900" 
                style={{ width: speaker.percentage + '%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
  `.trim(),
  createdAt: new Date().toISOString()
};

const components: Component[] = [exampleLLMComponent, exampleCodeComponent];

async function upsertComponent(component: Component): Promise<{ success: boolean }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (HARPERDB_USERNAME && HARPERDB_PASSWORD) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${HARPERDB_USERNAME}:${HARPERDB_PASSWORD}`).toString('base64');
  }
  
  const response = await fetch(`${HARPERDB_URL}/Component/${component.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(component)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HarperDB error: ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : { success: true };
}

async function seedComponents(): Promise<void> {
  console.log('🧩 Starting component seed...\n');
  console.log(`📡 Connecting to: ${HARPERDB_URL}\n`);

  try {
    for (const component of components) {
      console.log(`📝 Seeding component: "${component.component_name}" (${component.component_type})`);
      
      await upsertComponent(component);
      
      console.log(`  ✅ Component "${component.component_name}" seeded successfully`);
    }

    console.log(`\n✨ Database seeded with ${components.length} component(s)!`);
    console.log('💡 You can run this script again anytime - it\'s idempotent!\n');

  } catch (error) {
    console.error('❌ Error seeding database:', (error as Error).message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

seedComponents();

