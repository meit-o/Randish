package com.example.enishi;

import com.example.restaurantroulette.controller.ApiExceptionHandler;
import com.example.restaurantroulette.config.RandishRateLimitFilter;
import com.example.restaurantroulette.service.PasswordHashService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

/** Separate entry point: reuses the existing stack without loading Randish credentials or services. */
@SpringBootApplication(scanBasePackages="com.example.restaurantroulette.enishi")
@Import({PasswordHashService.class, RandishRateLimitFilter.class, ApiExceptionHandler.class})
public class EnishiApplication {
  public static void main(String[] args) {
    var app=new SpringApplication(EnishiApplication.class);
    app.setAdditionalProfiles("enishi");
    app.run(args);
  }
}
