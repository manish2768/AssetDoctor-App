/**
 * Asset Doctor — Partner & Integration API Layer (v1)
 * Clean RESTful domain router at /api/v1/ ensuring external partners interact with stable domain models
 * rather than internal Firestore document topologies.
 */

export interface ApiV1Response<T = any> {
  apiVersion: '1.0';
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

export class ApiV1Router {
  public static createSuccessResponse<T>(data: T): ApiV1Response<T> {
    return {
      apiVersion: '1.0',
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
  }

  public static createErrorResponse(code: string, message: string): ApiV1Response {
    return {
      apiVersion: '1.0',
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString()
    };
  }
}
