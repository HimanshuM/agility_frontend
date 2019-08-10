class AgNavbar extends Component {
	templateUrl = "/js/components/ag_button/ag_button.html";
	selector = "ag-button";
	styleSheets = ["/js/components/ag_button/ag_button.css"];
	onInit() {
		var navbar = this.element.find(".ag-navbar")[0];
		for (var i = 0; i < this.$children.length; i++) {
			navbar.nativeElement.appendChild(this.$children[i]);
		}
	}
}