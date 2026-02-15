import { z } from "zod";
import type { ZeroXgaslessSmartAccount } from "@0xgasless/smart-account";
import type { AgentkitAction } from "../agentkit";
import { getActiveAddress, isEoaMode } from "../services";

const GET_ADDRESS_PROMPT = `
This tool retrieves the wallet address (Smart Account or EOA) that is currently active.
No additional wallet setup or private key generation is needed.

USAGE GUIDANCE:
- When a user asks for their wallet address, account address, or smart account address, use this tool immediately
- No parameters are needed to retrieve the address
- The address can be used for receiving tokens or for verification purposes
- This is a read-only operation that doesn't modify any blockchain state

Note: This action works on all supported networks (Base, Sonic, Moonbeam, Avalanche, BSC, Sepolia).
`;

export const GetAddressInput = z
	.object({})
	.strip()
	.describe("No input required to get the wallet address");

/**
 * Gets the active wallet address (Smart Account or EOA depending on mode).
 *
 * @returns A message containing the wallet address.
 */
export async function getAddress(
	wallet: ZeroXgaslessSmartAccount,
	args: z.infer<typeof GetAddressInput>,
): Promise<string> {
	try {
		const address = await getActiveAddress(wallet);

		return `Your wallet address is ${address}. This is your secure, non-custodial wallet where your funds are stored.`;
	} catch (error) {
		console.error("Error getting address:", error);
		return `Error getting address: ${error instanceof Error ? error.message : String(error)}`;
	}
}

/**
 * Get smart account address action.
 */
export class GetAddressAction
	implements AgentkitAction<typeof GetAddressInput>
{
	public name = "get_address";
	public description = GET_ADDRESS_PROMPT;
	public argsSchema = GetAddressInput;
	public func = getAddress;
	public smartAccountRequired = true;
}
