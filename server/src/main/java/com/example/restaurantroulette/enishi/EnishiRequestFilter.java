package com.example.restaurantroulette.enishi;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile("enishi")
public class EnishiRequestFilter extends OncePerRequestFilter {
  @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
    if(request.getRequestURI().startsWith("/api/enishi/")) {
      response.setHeader("Cache-Control","no-store");
      response.setHeader("X-Content-Type-Options","nosniff");
      // A non-simple header plus SameSite cookie prevents cross-site form/CSRF requests.
      if(!request.getMethod().equals("GET")&&!request.getMethod().equals("OPTIONS")&&!"1".equals(request.getHeader("X-Enishi-Request"))) {
        response.setStatus(403);response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"画面を再読み込みしてお試しください。\"}");return;
      }
    }
    chain.doFilter(request,response);
  }
}
