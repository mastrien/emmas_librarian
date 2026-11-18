/** What the person is asked to approve: the tool and the arguments it would run with. */
export interface ConfirmRequest {
  tool: string;
  command: string;
  input: unknown;
}

/**
 * Where a person says yes or no to a call that changes the library. The app puts a dialog behind it, a terminal asks
 * on the keyboard, an evaluation answers from a script. Without one, nothing that needs approval runs (#27).
 */
export interface Confirmer {
  confirm(request: ConfirmRequest): Promise<boolean>;
}

/** The safe default: nobody approves anything. */
export const DENY_ALL: Confirmer = { confirm: async () => false };
