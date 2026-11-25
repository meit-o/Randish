package com.example.restaurantroulette.enishi;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@Profile("enishi")
@EnableScheduling
public class EnishiConfiguration {
  @Bean public Clock enishiClock() { return Clock.systemUTC(); }
}
