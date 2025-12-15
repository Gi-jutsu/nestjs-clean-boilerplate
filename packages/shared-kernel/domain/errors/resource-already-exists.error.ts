import { DateTime } from "luxon";

type ExtensionMembers = Pick<
  ResourceAlreadyExistsError,
  "resource" | "conflictingFieldName" | "conflictingFieldValue"
>;

export class ResourceAlreadyExistsError extends Error {
  /** (RFC9457) Members of a Problem Details Object */
  code: string;
  detail: string;
  status: number;
  title: string;
  timestamp: DateTime;
  pointer?: string;

  /** (RFC9457) Extension Members */
  resource: string;
  conflictingFieldName: string;
  conflictingFieldValue: string;

  constructor(input: ExtensionMembers) {
    super(`The ${input.resource} you are trying to create already exists.`);

    this.code = "resource-already-exists";
    this.detail = this.message;
    this.status = 409;
    this.title = "Resource Already Exists";
    this.timestamp = DateTime.now();
    this.pointer = `/data/attributes/${input.conflictingFieldName}`;

    this.resource = input.resource;
    this.conflictingFieldName = input.conflictingFieldName;
    this.conflictingFieldValue = input.conflictingFieldValue;
  }
}
