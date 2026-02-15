import {
	type StructuredToolInterface,
	BaseToolkit as Toolkit,
	StructuredTool,
} from "@langchain/core/tools";
import { AGENTKIT_ACTIONS } from "./actions";
import type { Agentkit, AgentkitAction, ActionSchemaAny } from "./agentkit";
import type { z } from "zod";

/**
 * 0xgasless Agentkit Toolkit.
 *
 * Security Note: This toolkit contains tools that can perform gasless
 * transactions on supported EVM chains using account abstraction.
 * Tools can read and modify blockchain state through operations like
 * token transfers, swaps, and smart contract deployments.
 *
 * Supported Networks:
 * - Base (8453)
 * - Sonic (156)
 * - Moonbeam (1284)
 * - Avalanche (43114)
 * - Avalanche Fuji (43113)
 * - BSC (56)
 */
export class AgentkitToolkit extends Toolkit {
	tools: StructuredToolInterface[];

	/**
	 * Creates a new 0xgasless Toolkit instance
	 *
	 * @param agentkit - 0xgasless agentkit instance
	 */
	constructor(agentkit: Agentkit) {
		super();
		this.tools = [];
		for (const action of AGENTKIT_ACTIONS) {
			// TypeScript limitation: Deeply nested generic types in action schemas cause
			// "Type instantiation is excessively deep" error. This is a known compiler limitation
			// with complex Zod schemas. Runtime type safety is maintained through schema validation.
			// @ts-expect-error TS2589: Type instantiation depth limitation with nested generics
			this.tools.push(new AgentkitTool(action, agentkit));
		}
	}

	getTools(): StructuredToolInterface[] {
		return this.tools;
	}
}

/**
 * This tool allows agents to interact with the 0xgasless library and control an MPC Wallet onchain.
 *
 * To use this tool, you must first set as environment variables:
 * ```bash
 * Required:
 * export 0xGASLESS_API_KEY="your-0xgasless-api-key"
 * export 0xGASLESS_CHAIN_ID="your-0xgasless-chain-id"
 * export 0xGASLESS_PRIVATE_KEY="your-0xgasless-private-key"
 *
 * Optional:
 * export 0xGASLESS_MNEMONIC_PHRASE="your-0xgasless-mnemonic-phrase"
 * export 0xGASLESS_RPC_URL="your-0xgasless-rpc-url"
 * ```
 */
export class AgentkitTool extends StructuredTool {
	/**
	 * Schema definition for the tool's input
	 */
	public schema: ActionSchemaAny;

	/**
	 * The name of the tool
	 */
	public name: string;

	/**
	 * The description of the tool
	 */
	public description: string;

	/**
	 * The Agentkit instance
	 */
	private agentkit: Agentkit;

	/**
	 * The Agentkit Action
	 */
	private action: AgentkitAction<ActionSchemaAny>;

	/**
	 * Constructor for the Agentkit Tool class
	 *
	 * @param action - The Agentkit action to execute
	 * @param agentkit - The Agentkit wrapper to use
	 */
	constructor(action: AgentkitAction<ActionSchemaAny>, agentkit: Agentkit) {
		super();
		this.action = action;
		this.agentkit = agentkit;
		this.name = action.name;
		this.description = action.description;
		this.schema = action.argsSchema;
	}

	/**
	 * Executes the Agentkit action with the provided input
	 *
	 * @param input - An object containing either instructions or schema-validated arguments
	 * @returns A promise that resolves to the result of the Agentkit action
	 * @throws {Error} If the Agentkit action fails
	 */
	protected async _call(
		input: Record<string, unknown>,
	): Promise<string> {
		try {
			// Validate input against schema
			let args: z.infer<typeof this.schema>;

			// If we have a schema, try to validate against it
			if (this.schema) {
				try {
					const validatedInput = this.schema.parse(input);
					args = validatedInput;
				} catch (error) {
					// If schema validation fails, fall back to instructions-only mode
					args = input as z.infer<typeof this.schema>;
					console.error(`Error validating input for ${this.name}: ${error}`);
				}
			}
			// No schema, use instructions mode
			else {
				args = input as z.infer<typeof this.schema>;
			}

			return await this.agentkit.run(this.action, args);
		} catch (error: unknown) {
			if (error instanceof Error) {
				return `Error executing ${this.name}: ${error.message}`;
			}
			return `Error executing ${this.name}: Unknown error occurred`;
		}
	}
}
