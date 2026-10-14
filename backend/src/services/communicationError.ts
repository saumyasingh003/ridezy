import { AppError } from "../utils/AppError.js";

/** Stable codes clients can branch on (socket acks and REST share them). */
export type CommunicationErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "RIDE_NOT_FOUND"
  | "COMMUNICATION_NOT_STARTED"
  | "COMMUNICATION_CLOSED"
  | "PEER_OFFLINE"
  | "PEER_RECONNECTING"
  | "CALL_BUSY"
  | "CALL_NOT_FOUND"
  | "CALL_NOT_ANSWERED"
  | "CALL_ALREADY_ANSWERED"
  | "INTERNAL_ERROR";

/** An AppError that also carries a machine-readable code. */
export class CommunicationError extends AppError {
  readonly code: CommunicationErrorCode;

  constructor(statusCode: number, code: CommunicationErrorCode, message: string) {
    super(statusCode, message);
    this.name = "CommunicationError";
    this.code = code;
  }
}
