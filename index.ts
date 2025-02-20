import { z } from 'zod'
import { Agent } from '@openserv-labs/sdk'
import 'dotenv/config'
import { runAudit } from './util/lighthouse'

function normalizeUrl(input: string): string {
  // Remove any unwanted prefix like "Website URL: "
  const cleanedInput = input.replace(/^Website URL:\s*/i, "");

  try {
    // Ensure input starts with http
    if (!/^https?:\/\//i.test(cleanedInput)) {
      throw new Error("Invalid URL: Must start with http or https");
    }

    // Create a URL object to normalize the structure
    const url = new URL(cleanedInput);

    // Normalize pathname by removing redundant slashes
    url.pathname = url.pathname.replace(/\/+/g, '/');

    // Remove trailing slash for consistency (except root paths)
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch (error) {
    throw new Error("Invalid URL input");
  }
}

class AuditAgent extends Agent {
  protected async doTask(action: z.infer<typeof doTaskActionSchema>) {
    if (!action.task) return;

    try {
      await this.updateTaskStatus({
        workspaceId: action.workspace.id,
        taskId: action.task.id,
        status: 'in-progress'
      });

      // Implement custom analysis logic
      const result = await this.analyzeData(action.task.input, action);

      await this.completeTask({
        workspaceId: action.workspace.id,
        taskId: action.task.id,
        output: JSON.stringify(result)
      });
    } catch (error) {
      await this.handleAuditError(action, error);
    }
  }

  private async analyzeData(input: string, action: z.infer<typeof doTaskActionSchema>) {
    try {
      if (!input || input.trim() === "") {
        // 🚨 No website provided → Request human assistance
        await agent.requestHumanAssistance({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          type: 'text',
          question: "The task requires a website URL, but none was provided. Please provide a valid URL to proceed.",
          agentDump: { inputReceived: input, taskDetails: action.task }
        });

        throw new Error("No website URL provided. Requesting human assistance.");
      }

      // Normalize the URL and proceed with audit
      const normalizedUrl = normalizeUrl(input);
      const results = await runAudit(normalizedUrl);

      // Upload audit results
      await agent.uploadFile({
        workspaceId: action.workspace.id,
        path: 'audit.json',
        file: JSON.stringify(results),
        skipSummarizer: false,
      });

      return results;
    } catch (error) {
      throw new Error("Failed to process audit: " + error.message);
    }
  }


  private async handleAuditError(action: any, error: any) {
    console.error("Error occurred: ", error.message);

  }
}
// Create the agent
export const agent = new AuditAgent({
  systemPrompt: `This agent uploads an audit using Google's Lighthouse API, expected output "audit.json"`,
})

// Add sum capability
// Add multiple capabilities at once
agent.addCapability({
  name: 'fetch-audit',
  description: 'Fetch an audit of the user requested Website using Google Lighthouse API',
  schema: z.object({
    website: z.string(),
  }),
  async run({ args, action }) {

    // const results = await runAudit(args.website ?? '');
    // await agent.uploadFile({
    //   workspaceId: action?.workspace.id ?? 0,
    //   path: 'audit.json',
    //   file: JSON.stringify(results),
    //   skipSummarizer: false,
    //   taskIds: action?.type === 'do-task' ? action.task.id : 0 // Associate with tasks
    // })
    return 'Audit done'
  }
});

// Start the agent's HTTP server
agent.start()

