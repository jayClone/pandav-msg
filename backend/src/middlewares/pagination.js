/**
 * Pagination middleware
 * Extracts page and limit from query params
 * Validates and sets defaults
 */
export const pagination = (req, res, next) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 50;

    // Validate
    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 50 : limit;
    limit = limit > 500 ? 500 : limit;  // Max 500 per page

    const skip = (page - 1) * limit;

    // Attach to request
    req.pagination = {
      page,
      limit,
      skip,
    };

    next();
  } catch (error) {
    console.error('Pagination middleware error:', error.message);
    next();
  }
};