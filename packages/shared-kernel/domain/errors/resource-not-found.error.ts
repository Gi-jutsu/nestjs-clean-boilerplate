import { DateTime } from "luxon";

type ExtensionMembers = Pick<
  ResourceNotFoundError,
  "resource" | "searchedByFieldName" | "searchedByValue"
>;

export class ResourceNotFoundError extends Error {
  /** (RFC9457) Members of a Problem Details Object */
  code: string;
  detail: string;
  status: number;
  title: string;
  timestamp: DateTime;
  pointer?: string;

  /** (RFC9457) Extension Members */
  resource: string;
  searchedByFieldName: string;
  searchedByValue: string;

  constructor(input: ExtensionMembers) {
    super(`The ${input.resource} you are trying to access does not exist.`);

    this.code = "resource-not-found";
    this.detail = this.message;
    this.status = 404;
    this.title = "Resource Not Found";
    this.timestamp = DateTime.now();
    this.pointer = `/data/attributes/${input.searchedByFieldName}`;

    this.resource = input.resource;
    this.searchedByFieldName = input.searchedByFieldName;
    this.searchedByValue = input.searchedByValue;
  }
}
