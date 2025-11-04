type Environment = 'local' | 'prod';

export const config = {
  s3ConvosBucketName: import.meta.env.VITE_S3_CONVOS_BUCKET_NAME as string,
  harperdbUrl: import.meta.env.VITE_HARPERDB_URL as string,
  environment: import.meta.env.VITE_ENVIRONMENT as Environment,
};

function validateConfig() {
  const requiredVars = {
    VITE_S3_CONVOS_BUCKET_NAME: config.s3ConvosBucketName,
    VITE_HARPERDB_URL: config.harperdbUrl,
    VITE_ENVIRONMENT: config.environment,
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(', ')}\n` +
      `📝 Create a .env.local file with all required variables.\n` +
      `See .env.example for details.`
    );
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate configuration when the module is imported
validateConfig();

// Log configuration in local
if (config.environment === 'local') {
  console.debug('🔧 ConvoIQ Configuration:', {
    s3ConvosBucketName: config.s3ConvosBucketName,
    harperdbUrl: config.harperdbUrl,
    environment: config.environment,
  });
}

