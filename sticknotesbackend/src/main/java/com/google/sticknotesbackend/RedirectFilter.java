/**
 * Copyright 2020 Google LLC
 */
package com.google.sticknotesbackend;

import java.io.IOException;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.RequestDispatcher;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;

/**
 * Angular requests must be forwarded to index.html. This filter provides custom
 * logic of forwarding app requests
 */
public class RedirectFilter implements Filter {
  private FilterConfig config = null;

  /**
   * Filters the incoming requests and forwards it to "index.html" if the request
   * is Angular route redirect.
   */
  public void doFilter(final ServletRequest request, final ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    ServletContext context = config.getServletContext();
    HttpServletRequest httpRequest = (HttpServletRequest) request;
    // if request is not to API, forward it to 'index.html', otherwise do nothing
    if (!isApiUri(httpRequest.getRequestURI())) {
      // request to angular, forward it to the index.html
      RequestDispatcher dispatcher = context.getRequestDispatcher("/index.html");
      dispatcher.forward(request, response);
    } else {
      chain.doFilter(request, response);
    }
  }

  /**
   * Checks if requests is to API or Angular by checking the request's URI.
   */
  private boolean isApiUri(String uri) {
    return uri.startsWith("api") || uri.startsWith("/api") || uri.startsWith("/_ah/") || uri.startsWith("_ah/");
  }

  @Override
  public void init(FilterConfig filterConfig) throws ServletException {
    this.config = filterConfig;
  }

  @Override
  public void destroy() {
    config = null;
  }
}
