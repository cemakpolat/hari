import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Form scenario: "Configure deployment parameters"
//
// The agent needs structured input from the user to deploy a service.
// Demonstrates all form field types, validation, conditional visibility,
// and sensitive data handling.
// ─────────────────────────────────────────────────────────────────────────────

export const formDeploymentIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'form',
  domain: 'deployment',
  primaryGoal: 'Collect deployment configuration from user',
  confidence: 0.95,
  density: 'operator',
  layoutHint: 'form',

  data: {
    formId: 'deploy-config-001',
    sections: [
      {
        id: 'basic',
        title: 'Basic Configuration',
        description: 'Core deployment settings',
        fields: [
          {
            type: 'text',
            id: 'service_name',
            label: 'Service Name',
            description: 'A unique identifier for this service',
            placeholder: 'my-api-service',
            required: true,
            validation: [
              {
                type: 'required',
                message: 'Service name is required',
              },
              {
                type: 'pattern',
                pattern: '^[a-z0-9-]+$',
                message: 'Only lowercase letters, numbers, and hyphens allowed',
              },
              {
                type: 'min',
                value: 3,
                message: 'Must be at least 3 characters',
              },
            ],
          },
          {
            type: 'select',
            id: 'environment',
            label: 'Environment',
            description: 'Target deployment environment',
            required: true,
            options: [
              { value: 'dev', label: 'Development', description: 'Local development' },
              { value: 'staging', label: 'Staging', description: 'Pre-production testing' },
              { value: 'production', label: 'Production', description: 'Live environment' },
            ],
            defaultValue: 'dev',
          },
          {
            type: 'select',
            id: 'region',
            label: 'Region',
            description: 'Geographic region for deployment',
            required: true,
            options: [
              { value: 'us-east-1', label: 'US East (N. Virginia)' },
              { value: 'us-west-2', label: 'US West (Oregon)' },
              { value: 'eu-west-1', label: 'EU (Ireland)' },
              { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
            ],
          },
        ],
      },
      {
        id: 'resources',
        title: 'Resource Configuration',
        description: 'Compute and memory settings',
        fields: [
          {
            type: 'number',
            id: 'cpu_cores',
            label: 'CPU Cores',
            helpText: 'Number of virtual CPU cores to allocate',
            required: true,
            min: 1,
            max: 16,
            step: 1,
            unit: 'cores',
            defaultValue: 2,
            validation: [
              {
                type: 'min',
                value: 1,
                message: 'At least 1 core required',
              },
              {
                type: 'max',
                value: 16,
                message: 'Maximum 16 cores allowed',
              },
            ],
          },
          {
            type: 'slider',
            id: 'memory_gb',
            label: 'Memory',
            helpText: 'Memory allocation in GB',
            min: 1,
            max: 64,
            step: 1,
            defaultValue: 4,
            showValue: true,
            minLabel: '1 GB',
            maxLabel: '64 GB',
          },
          {
            type: 'number',
            id: 'replicas',
            label: 'Replica Count',
            description: 'Number of service instances',
            required: true,
            min: 1,
            max: 10,
            defaultValue: 3,
            unit: 'instances',
          },
        ],
      },
      {
        id: 'networking',
        title: 'Network Configuration',
        collapsible: true,
        defaultCollapsed: false,
        fields: [
          {
            type: 'number',
            id: 'port',
            label: 'Port',
            description: 'Service port number',
            required: true,
            min: 1024,
            max: 65535,
            defaultValue: 8080,
          },
          {
            type: 'checkbox',
            id: 'enable_https',
            label: 'Enable HTTPS',
            description: 'Terminate TLS at load balancer',
            defaultValue: true,
          },
          {
            type: 'text',
            id: 'custom_domain',
            label: 'Custom Domain',
            description: 'Optional custom domain name',
            placeholder: 'api.example.com',
            conditionalVisibility: {
              dependsOn: 'enable_https',
              value: true,
            },
            validation: [
              {
                type: 'pattern',
                pattern: '^[a-z0-9.-]+\\.[a-z]{2,}$',
                message: 'Invalid domain format',
              },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Security Settings',
        collapsible: true,
        defaultCollapsed: false,
        fields: [
          {
            type: 'text',
            id: 'api_key',
            label: 'API Key',
            description: 'Service authentication key',
            sensitive: true,
            required: true,
            placeholder: 'Enter your API key',
            validation: [
              {
                type: 'min',
                value: 32,
                message: 'API key must be at least 32 characters',
              },
            ],
          },
          {
            type: 'radio',
            id: 'auth_method',
            label: 'Authentication Method',
            required: true,
            layout: 'vertical',
            options: [
              { value: 'api_key', label: 'API Key', description: 'Simple key-based auth' },
              { value: 'oauth', label: 'OAuth 2.0', description: 'Token-based auth' },
              { value: 'jwt', label: 'JWT', description: 'JSON Web Tokens' },
            ],
            defaultValue: 'api_key',
          },
          {
            type: 'multi_select',
            id: 'allowed_origins',
            label: 'Allowed Origins',
            description: 'CORS allowed origins',
            options: [
              { value: 'localhost', label: 'localhost' },
              { value: 'example.com', label: 'example.com' },
              { value: 'app.example.com', label: 'app.example.com' },
              { value: 'admin.example.com', label: 'admin.example.com' },
            ],
            defaultValue: ['localhost'],
          },
        ],
      },
      {
        id: 'advanced',
        title: 'Advanced Options',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          {
            type: 'text',
            id: 'health_check_path',
            label: 'Health Check Path',
            placeholder: '/health',
            defaultValue: '/health',
          },
          {
            type: 'number',
            id: 'timeout_seconds',
            label: 'Request Timeout',
            unit: 'seconds',
            min: 1,
            max: 300,
            defaultValue: 30,
          },
          {
            type: 'checkbox',
            id: 'enable_logging',
            label: 'Enable detailed logging',
            defaultValue: true,
          },
          {
            type: 'checkbox',
            id: 'enable_metrics',
            label: 'Enable metrics collection',
            defaultValue: true,
          },
          {
            type: 'text',
            id: 'custom_tags',
            label: 'Custom Tags',
            description: 'Comma-separated tags for resource organization',
            placeholder: 'team:backend,cost-center:eng',
            multiline: true,
            rows: 3,
          },
        ],
      },
    ],
  },

  actions: [
    {
      id: 'preview',
      label: 'Preview Configuration',
      description: 'Review deployment configuration before submitting',
      variant: 'secondary',
    },
    {
      id: 'deploy',
      label: 'Deploy Service',
      description: 'Deploy with the specified configuration',
      variant: 'primary',
      safety: {
        confidence: 0.92,
        reversible: true,
        riskLevel: 'medium',
        requiresConfirmation: true,
        confirmationDelay: 1000,
        explanation: 'This will create a new deployment in the selected environment',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['compute', 'networking', 'monitoring'],
          downstreamEffects: 'New service instances will be created',
          estimatedImpact: 'Minimal - new isolated deployment',
        },
        cost: 120,
        currency: 'USD/month',
      },
    },
  ],

  explainability: {
    'form-deployment': {
      elementId: 'form-deployment',
      summary: 'Collecting these parameters ensures the deployment meets your requirements and follows best practices',
      dataSources: [
        {
          type: 'documentation',
          name: 'Deployment Best Practices',
          freshness: new Date().toISOString(),
        },
      ],
      assumptions: [
        'Based on your environment selection, recommended defaults optimize for reliability and cost',
        'Standard configuration follows industry best practices',
      ],
      alternativesConsidered: [
        {
          description: 'Auto-scaling configuration',
          reason: 'Better resource utilization but higher complexity for initial deployment',
        },
        {
          description: 'Serverless deployment',
          reason: 'Lower maintenance but different programming model requiring code changes',
        },
      ],
      whatIfQueries: [
        'What if I choose production environment?',
        'What if I increase memory to 64GB?',
        'What if I disable HTTPS?',
      ],
    },
  },
};
