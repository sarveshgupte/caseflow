/**
 * Slugify Utility
 * Converts strings to URL-safe slugs
 */

/**
 * Convert a string to a URL-safe slug
 * @param {string} text - Text to slugify
 * @returns {string} URL-safe slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

module.exports = { slugify };
