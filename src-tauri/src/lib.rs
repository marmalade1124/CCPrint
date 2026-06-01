use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let child_mutex = Arc::new(Mutex::new(None::<Child>));
  let child_mutex_setup = child_mutex.clone();
  let child_mutex_run = child_mutex.clone();

  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .setup(move |app| {
      if cfg!(debug_assertions) {
        let _ = app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        );
      }

      let resource_dir = app.path().resource_dir().unwrap_or_default();
      let exe_dir = std::env::current_exe()
          .map(|p| p.parent().map(|d| d.to_path_buf()).unwrap_or_default())
          .unwrap_or_default();
      let cwd = std::env::current_dir().unwrap_or_default();

      // Check multiple locations for server.cjs (production bundles) and server.js (dev mode)
      let paths_to_check = vec![
          // 1. Check for server.cjs (built CommonJS)
          cwd.join("dist-server").join("server.cjs"),
          exe_dir.join("dist-server").join("server.cjs"),
          resource_dir.join("dist-server").join("server.cjs"),
          resource_dir.join("_up_").join("dist-server").join("server.cjs"),
          cwd.join("server.cjs"),
          exe_dir.join("server.cjs"),
          resource_dir.join("server.cjs"),
          // 2. Check for server.js (original ES module / legacy)
          cwd.join("server.js"),
          exe_dir.join("server.js"),
          resource_dir.join("server.js"),
          resource_dir.join("dist-server").join("server.js"),
          resource_dir.join("_up_").join("dist-server").join("server.js"),
          cwd.join("dist-server").join("server.js"),
          exe_dir.join("dist-server").join("server.js"),
          cwd.join("..").join("server.js"),
      ];

      let mut server_path = std::path::PathBuf::from("server.cjs");
      for path in paths_to_check {
          if path.exists() {
              server_path = path;
              break;
          }
      }

      let parent_dir = server_path.parent().unwrap_or(&cwd);

      // Strip UNC prefix (\\?\) on Windows for both server_path and parent_dir
      let mut server_path_str = server_path.to_string_lossy().into_owned();
      if server_path_str.starts_with(r"\\?\") {
          server_path_str = server_path_str[4..].to_string();
      }

      let mut parent_dir_str = parent_dir.to_string_lossy().into_owned();
      if parent_dir_str.starts_with(r"\\?\") {
          parent_dir_str = parent_dir_str[4..].to_string();
      }

      // Create log directory and setup log file
      let log_dir = app.path().app_local_data_dir().unwrap_or_default();
      let _ = std::fs::create_dir_all(&log_dir);
      let log_file_path = log_dir.join("backend_spawn.log");

      // Write initial launch stats to log file
      if let Ok(mut log_file) = std::fs::OpenOptions::new()
          .create(true)
          .append(true)
          .open(&log_file_path) {
          use std::io::Write;
          let _ = writeln!(log_file, "\n--- Starting Backend Proxy Server ---");
          let _ = writeln!(log_file, "CWD: {:?}", cwd);
          let _ = writeln!(log_file, "Exe Dir: {:?}", exe_dir);
          let _ = writeln!(log_file, "Resource Dir: {:?}", resource_dir);
          let _ = writeln!(log_file, "Resolved Server Path (Raw): {:?}", server_path);
          let _ = writeln!(log_file, "Resolved Server Path (Cleaned): {:?}", server_path_str);
          let _ = writeln!(log_file, "Parent Dir (Raw): {:?}", parent_dir);
          let _ = writeln!(log_file, "Parent Dir (Cleaned): {:?}", parent_dir_str);
      }

      let mut cmd;
      #[cfg(target_os = "windows")]
      {
          use std::os::windows::process::CommandExt;
          cmd = Command::new("cmd");
          cmd.args(&["/C", "node", &server_path_str]);
          cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
      }
      #[cfg(not(target_os = "windows"))]
      {
          cmd = Command::new("node");
          cmd.arg(&server_path_str);
      }

      cmd.current_dir(&parent_dir_str);
      cmd.stdout(Stdio::piped());
      cmd.stderr(Stdio::piped());

      match cmd.spawn() {
          Ok(mut c) => {
              println!("Spawned backend Node.js proxy server process successfully.");
              
              if let Ok(mut log_file) = std::fs::OpenOptions::new()
                  .create(true)
                  .append(true)
                  .open(&log_file_path) {
                  use std::io::Write;
                  let _ = writeln!(log_file, "[INFO] Child process spawned successfully with PID: {:?}", c.id());
              }

              // Spawn thread for stdout
              if let Some(stdout) = c.stdout.take() {
                  let path = log_file_path.clone();
                  std::thread::spawn(move || {
                      use std::io::{BufRead, BufReader, Write};
                      let reader = BufReader::new(stdout);
                      for line in reader.lines() {
                          if let Ok(l) = line {
                              if let Ok(mut log_file) = std::fs::OpenOptions::new().append(true).open(&path) {
                                  let _ = writeln!(log_file, "[STDOUT] {}", l);
                              }
                          }
                      }
                  });
              }

              // Spawn thread for stderr
              if let Some(stderr) = c.stderr.take() {
                  let path = log_file_path.clone();
                  std::thread::spawn(move || {
                      use std::io::{BufRead, BufReader, Write};
                      let reader = BufReader::new(stderr);
                      for line in reader.lines() {
                          if let Ok(l) = line {
                              if let Ok(mut log_file) = std::fs::OpenOptions::new().append(true).open(&path) {
                                  let _ = writeln!(log_file, "[STDERR] {}", l);
                              }
                          }
                      }
                  });
              }

              let mut guard = child_mutex_setup.lock().unwrap();
              *guard = Some(c);
          }
          Err(err) => {
              eprintln!("Failed to spawn background Node.js proxy server: {:?}.", err);
              if let Ok(mut log_file) = std::fs::OpenOptions::new()
                  .create(true)
                  .append(true)
                  .open(&log_file_path) {
                  use std::io::Write;
                  let _ = writeln!(log_file, "[ERROR] Failed to spawn background Node.js proxy server: {:?}", err);
              }
          }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(move |_app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        let mut guard = child_mutex_run.lock().unwrap();
        if let Some(mut child) = guard.take() {
          println!("Terminating background Node.js proxy server child process...");
          let _ = child.kill();
        }
      }
    });
}
