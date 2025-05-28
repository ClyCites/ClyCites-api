export class ApiResponse {
  static success(data = null, message = "Success", meta = {}) {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    }
  }

  static error(message = "Error", details = null, statusCode = 500) {
    return {
      success: false,
      message,
      error: details,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode,
      },
    }
  }

  static paginated(data, pagination, message = "Success") {
    return {
      success: true,
      message,
      data,
      pagination,
      meta: {
        timestamp: new Date().toISOString(),
      },
    }
  }
}
