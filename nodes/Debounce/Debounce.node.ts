import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Debounce implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Debounce',
    name: 'debounce',
    icon: {
      light: 'file:Debounce.svg',
      dark: 'file:Debounce.dark.svg'
    },
    group: ['transform'],
    version: 1,
    description: 'Buffers payloads and releases them as a single block',
    defaults: {
      name: 'Debounce',
    },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: 'Identifier (Group Key)',
        name: 'identifier',
        type: 'string',
        default: '',
        description:
          'The unique key to group incoming items by (e.g., User ID, IP address, Webhook ID)',
      },
      {
        displayName: 'Payload to Buffer',
        name: 'payload',
        type: 'string',
        default: '',
        description: 'The actual data you want to collect and bundle together',
      },
      {
        // eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
        displayName: 'Wait Time (ms)',
        name: 'waitTime',
        type: 'number',
        default: 3000,
        description: 'How long to wait for new items before releasing the bundled data',
      },
    ],
  };

  private static memoryStore = new Map<string, { messages: string[]; timestamp: number }>();

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();

    for (let i = 0; i < items.length; i++) {
      try {
        const sessionId = this.getNodeParameter('identifier', i) as string;
        const message = this.getNodeParameter('payload', i) as string;
        const waitTime = this.getNodeParameter('waitTime', i) as number;

        const now = Date.now();

        if (!Debounce.memoryStore.has(sessionId)) {
          Debounce.memoryStore.set(sessionId, { messages: [], timestamp: now });
        }

        const session = Debounce.memoryStore.get(sessionId)!;
        session.messages.push(message);
        session.timestamp = now;

        // eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        if (session.timestamp === now) {
          Debounce.memoryStore.delete(sessionId);

          const executionData: INodeExecutionData = {
            json: {
              sessionId,
              messages: [...session.messages],
            },
            pairedItem: i,
          };

          return [[executionData]];
        }
      } catch (error) {
        if (this.continueOnFail()) {
          items.push({
            json: this.getInputData(i)[0].json,
            error,
            pairedItem: i,
          });
        } else {
          throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
        }
      }
    }

    return [];
  }
}
